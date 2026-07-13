import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deliveryTicketId } = body;

    if (!deliveryTicketId) {
      return NextResponse.json(
        { error: "Delivery Ticket ID is required." },
        { status: 400 }
      );
    }

    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { deliveryTicketId },
      include: { items: true },
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Invoice already exists for this Delivery Ticket.", invoice: existingInvoice },
        { status: 400 }
      );
    }

    // Fetch the Delivery Ticket along with items and delivery orders
    const dt = await prisma.deliveryTicket.findUnique({
      where: { id: deliveryTicketId },
      include: {
        customer: true,
        items: true,
        deliveryOrders: true,
      },
    });

    if (!dt) {
      return NextResponse.json(
        { error: "Delivery Ticket not found." },
        { status: 404 }
      );
    }

    // Calculate quantities
    const totalPcs = dt.totalPcs || dt.items.reduce((sum, item) => sum + (item.delQtyPcs || 0), 0) || 0;
    const totalLiter = dt.totalLiter || dt.items.reduce((sum, item) => sum + (item.delQtyLiter || 0), 0) || 0;
    const totalPallets = dt.totalPallets || Math.max(1, Math.ceil(totalPcs / 100)); // Default 1 pallet per 100 pcs if not specified
    const doCount = dt.deliveryOrders.length || 1;

    // Fetch active pricing rates from DB (fallback to defaults if not configured)
    const pricingRates = await prisma.pricingRate.findMany({ where: { isActive: true } });
    const getRate = (key: string, fallback: number) =>
      pricingRates.find((r) => r.key === key)?.unitPrice ?? fallback;

    const RATES = {
      handlingOut: getRate("handling_out", 500),
      picking:     getRate("picking",      2000),
      storage:     getRate("storage",      50000),
      delivery:    getRate("delivery",     350000),
      admin:       getRate("admin",        25000),
    };

    const invoiceItemsData = [
      {
        activityName: "Handling Out Fee",
        description: `Handling out service fee for ${totalLiter.toLocaleString()} liters of product`,
        quantity: totalLiter,
        unitPrice: RATES.handlingOut,
        totalPrice: totalLiter * RATES.handlingOut,
      },
      {
        activityName: "Picking Fee",
        description: `Warehouse picking fee for ${totalPcs.toLocaleString()} pcs of items`,
        quantity: totalPcs,
        unitPrice: RATES.picking,
        totalPrice: totalPcs * RATES.picking,
      },
      {
        activityName: "Storage Fee",
        description: `Pallet storage fee for ${totalPallets} pallet(s)`,
        quantity: totalPallets,
        unitPrice: RATES.storage,
        totalPrice: totalPallets * RATES.storage,
      },
      {
        activityName: "Delivery Fee",
        description: `Transportation fee for ${doCount} delivery shipment(s) via ${dt.vehicleNo || dt.haulierCompany || "Sinaga Transport"}`,
        quantity: doCount,
        unitPrice: RATES.delivery,
        totalPrice: doCount * RATES.delivery,
      },
      {
        activityName: "Administration Fee",
        description: "Standard document administration processing fee",
        quantity: 1,
        unitPrice: RATES.admin,
        totalPrice: 1 * RATES.admin,
      },
    ];

    // Filter out items with 0 price (just in case)
    const activeItems = invoiceItemsData.filter((item) => item.totalPrice > 0);
    const totalAmount = activeItems.reduce((sum, item) => sum + item.totalPrice, 0);

    const invoice = await prisma.$transaction(async (tx) => {
      // Generate Invoice Number
      const currentYear = new Date().getFullYear();
      const prefix = `INV-${currentYear}-`;
      const latestInvoice = await tx.invoice.findFirst({
        where: {
          invoiceNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          invoiceNumber: "desc",
        },
      });

      let nextSeq = 1;
      if (latestInvoice) {
        const parts = latestInvoice.invoiceNumber.split("-");
        const seqStr = parts[parts.length - 1];
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
      const invoiceNumber = `INV-${currentYear}-${String(nextSeq).padStart(4, "0")}`;

      const issuedAt = new Date();
      const dueDate = new Date();
      dueDate.setDate(issuedAt.getDate() + 30); // 30-day payment term

      const newInvoice = await tx.invoice.create({
        data: {
          deliveryTicketId: dt.id,
          customerId: dt.customerId,
          invoiceNumber,
          totalAmount,
          status: "draft",
          issuedAt,
          dueDate,
          items: {
            create: activeItems.map((item) => ({
              activityName: item.activityName,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      return newInvoice;
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/invoices/generate error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
