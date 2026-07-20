import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundFloat } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { month, year, customerIds } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: "Month and year are required." },
        { status: 400 }
      );
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: "Invalid month value. Must be between 1 and 12." },
        { status: 400 }
      );
    }

    // Define billing period: first to last day of the selected month
    const periodStart = new Date(yearNum, monthNum - 1, 1);
    const periodEnd = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    // Find all completed delivery tickets in the period
    const whereClause: any = {
      createdAt: {
        gte: periodStart,
        lte: periodEnd,
      },
      invoice: null, // only tickets without invoice yet
    };

    if (customerIds && Array.isArray(customerIds) && customerIds.length > 0) {
      whereClause.customerId = { in: customerIds };
    }

    const tickets = await prisma.deliveryTicket.findMany({
      where: whereClause,
      include: {
        customer: true,
        items: true,
        deliveryOrders: true,
      },
    });

    if (tickets.length === 0) {
      return NextResponse.json(
        { message: "No uninvoiced delivery tickets found for the selected period.", generated: 0 },
        { status: 200 }
      );
    }

    // Fetch active pricing rates from DB (fallback to defaults if not configured)
    const pricingRates = await prisma.pricingRate.findMany({ where: { isActive: true } });
    const getRate = (key: string, fallback: number) =>
      pricingRates.find((r) => r.key === key)?.unitPrice ?? fallback;

    // Define pricing rates
    const RATES = {
      handlingOut: getRate("handling_out", 500),
      picking:     getRate("picking",      2000),
      storage:     getRate("storage",      50000),
      delivery:    getRate("delivery",     350000),
      admin:       getRate("admin",        25000),
    };

    const monthLabel = periodStart.toLocaleString("id-ID", { month: "long", year: "numeric" });
    const createdInvoices = [];
    const skipped = [];

    for (const dt of tickets) {
      try {
        const totalPcs = dt.totalPcs || dt.items.reduce((s, i) => s + (i.delQtyPcs || 0), 0) || 0;
        const totalLiter = roundFloat(dt.totalLiter || dt.items.reduce((s, i) => s + (i.delQtyLiter || 0), 0) || 0, 2);
        const totalPallets = dt.totalPallets || Math.max(1, Math.ceil(totalPcs / 100));
        const doCount = dt.deliveryOrders.length || 1;

        const invoiceItems = [
          {
            activityName: "Handling Out Fee",
            description: `Handling out service fee for ${totalLiter.toLocaleString()} liters — ${monthLabel}`,
            quantity: totalLiter,
            unitPrice: RATES.handlingOut,
            totalPrice: roundFloat(totalLiter * RATES.handlingOut, 2),
          },
          {
            activityName: "Picking Fee",
            description: `Warehouse picking fee for ${totalPcs.toLocaleString()} pcs — ${monthLabel}`,
            quantity: totalPcs,
            unitPrice: RATES.picking,
            totalPrice: roundFloat(totalPcs * RATES.picking, 2),
          },
          {
            activityName: "Storage Fee",
            description: `Pallet storage fee for ${totalPallets} pallet(s) — ${monthLabel}`,
            quantity: totalPallets,
            unitPrice: RATES.storage,
            totalPrice: roundFloat(totalPallets * RATES.storage, 2),
          },
          {
            activityName: "Delivery Fee",
            description: `Transportation fee for ${doCount} delivery shipment(s) — ${monthLabel}`,
            quantity: doCount,
            unitPrice: RATES.delivery,
            totalPrice: roundFloat(doCount * RATES.delivery, 2),
          },
          {
            activityName: "Administration Fee",
            description: `Document administration fee — ${monthLabel}`,
            quantity: 1,
            unitPrice: RATES.admin,
            totalPrice: roundFloat(1 * RATES.admin, 2),
          },
        ].filter((item) => item.totalPrice > 0);

        const totalAmount = roundFloat(invoiceItems.reduce((s, i) => s + i.totalPrice, 0), 2);

        const invoice = await prisma.$transaction(async (tx) => {
          const prefix = `INV-${yearNum}-`;
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
          const invoiceNumber = `INV-${yearNum}-${String(nextSeq).padStart(4, "0")}`;

          const issuedAt = new Date();
          const dueDate = new Date();
          dueDate.setDate(issuedAt.getDate() + 30);

          return await tx.invoice.create({
            data: {
              deliveryTicketId: dt.id,
              customerId: dt.customerId,
              invoiceNumber,
              totalAmount,
              status: "draft",
              issuedAt,
              dueDate,
              items: {
                create: invoiceItems.map((item) => ({
                  activityName: item.activityName,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
              },
            },
            include: { items: true, customer: true },
          });
        });

        createdInvoices.push(invoice);
      } catch (err: any) {
        skipped.push({ dtId: dt.id, dtNumber: dt.dtNumber, reason: err.message });
      }
    }

    return NextResponse.json(
      {
        success: true,
        generated: createdInvoices.length,
        skipped: skipped.length,
        skippedDetails: skipped,
        invoices: createdInvoices,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("POST /api/invoices/generate-monthly error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
