import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/delivery-tickets/[id] — get DT detail with stock location lookup per item
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ticket = await prisma.deliveryTicket.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: { fullName: true } },
        items: {
          orderBy: { lineNo: "asc" },
          include: {
            product: true,
          },
        },
        deliveryOrders: {
          select: { id: true, doNumber: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Delivery Ticket not found." }, { status: 404 });
    }

    // For each DT item, look up warehouse stock locations (FIFO by inboundDate)
    const itemsWithLocations = await Promise.all(
      ticket.items.map(async (item) => {
        // Match by productId first, fallback to productCode
        const whereClause = item.productId
          ? { productId: item.productId, quantity: { gt: 0 } }
          : {
              product: { productCode: item.productCode },
              quantity: { gt: 0 },
            };

        const stockEntries = await prisma.stockLedger.findMany({
          where: whereClause as any,
          orderBy: { inboundDate: "asc" }, // FIFO
          include: {
            palletPosition: {
              include: { rack: { select: { rackCode: true, rackName: true } } },
            },
            product: { select: { productCode: true, productName: true } },
          },
        });

        const locations = stockEntries.map((s) => ({
          stockLedgerId: s.id,
          positionCode: s.palletPosition.positionCode,
          rackCode: s.palletPosition.rack.rackCode,
          rackName: s.palletPosition.rack.rackName,
          batchNumber: s.batchNumber,
          availableQty: s.quantity - s.reservedQty,
          inboundDate: s.inboundDate,
        }));

        return { ...item, locations };
      })
    );

    return NextResponse.json({ ...ticket, items: itemsWithLocations });
  } catch (error: any) {
    console.error("GET /api/delivery-tickets/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
