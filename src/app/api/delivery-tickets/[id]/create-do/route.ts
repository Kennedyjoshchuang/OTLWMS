import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDO } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Run in a transaction
    const deliveryOrder = await prisma.$transaction(async (tx) => {
      // 1. Fetch DT
      const ticket = await tx.deliveryTicket.findUnique({
        where: { id },
        include: { items: true, deliveryOrders: true },
      });

      if (!ticket) {
        throw new Error("Delivery Ticket not found.");
      }

      if (ticket.deliveryOrders.length > 0) {
        return ticket.deliveryOrders[0];
      }

      // 2. Generate DO Number
      const year = new Date().getFullYear();
      const prefix = `OTL-PL-${year}-`;
      const latestDO = await tx.deliveryOrder.findFirst({
        where: {
          doNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          doNumber: "desc",
        },
      });

      let nextSeq = 1;
      if (latestDO) {
        const parts = latestDO.doNumber.split("-");
        const seqStr = parts[parts.length - 1];
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
      const doNumber = generateDO(nextSeq);

      // 3. Create DO
      const newDO = await tx.deliveryOrder.create({
        data: {
          doNumber,
          deliveryTicketId: ticket.id,
          customerId: ticket.customerId,
          destination: ticket.deliverToAddress || ticket.deliverToName || "Unknown Destination",
          status: "draft",
        },
      });

      // 4. Allocate picking items from StockLedger
      for (const item of ticket.items) {
        if (!item.productId || item.delQtyPcs <= 0) continue;

        let requiredQty = item.delQtyPcs;

        // Find available stock for this product, FIFO
        const stockEntries = await tx.stockLedger.findMany({
          where: {
            productId: item.productId,
            quantity: { gt: 0 },
          },
          orderBy: { inboundDate: "asc" },
          include: { palletPosition: true },
        });

        for (const stock of stockEntries) {
          if (requiredQty <= 0) break;

          const available = stock.quantity - stock.reservedQty;
          if (available <= 0) continue;

          const qtyToPick = Math.min(requiredQty, available);

          // Update reserved quantity
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: { reservedQty: stock.reservedQty + qtyToPick, isReserved: true },
          });

          // Create DOPickingItem
          await tx.dOPickingItem.create({
            data: {
              deliveryOrderId: newDO.id,
              dtItemId: item.id,
              productId: item.productId,
              stockLedgerId: stock.id,
              palletPositionId: stock.palletPositionId,
              positionCode: stock.palletPosition.positionCode,
              batchNumber: stock.batchNumber,
              requiredQty: qtyToPick,
              status: "pending",
            },
          });

          requiredQty -= qtyToPick;
        }

        if (requiredQty > 0) {
          // Log shortage
          console.warn(`Shortage for product ${item.productCode}: ${requiredQty} pcs unfulfilled.`);
        }
      }

      // 5. Update DT status
      await tx.deliveryTicket.update({
        where: { id: ticket.id },
        data: { status: "processing" },
      });

      return newDO;
    });

    return NextResponse.json({ success: true, deliveryOrder }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/delivery-tickets/[id]/create-do error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
