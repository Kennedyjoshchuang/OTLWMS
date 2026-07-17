import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { pickingItemId } = body;

    if (!pickingItemId) {
      return NextResponse.json({ error: "pickingItemId is required" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Fetch DO and the picking item
      const doRecord = await tx.deliveryOrder.findUnique({
        where: { id },
        include: { pickingItems: true },
      });

      if (!doRecord) throw new Error("Delivery Order not found.");

      const item = doRecord.pickingItems.find((p) => p.id === pickingItemId);
      if (!item) throw new Error("Picking item not found in this Delivery Order.");

      if (item.status !== "shipped") {
        throw new Error("Item has not been picked yet.");
      }

      // 2. Restore stock in StockLedger
      const stock = await tx.stockLedger.findUnique({
        where: { id: item.stockLedgerId },
      });

      if (!stock) throw new Error("Stock location not found.");

      const qtyToRestore = item.pickedQty ?? item.requiredQty;
      const restoredQty = stock.quantity + qtyToRestore;
      const restoredReservedQty = stock.reservedQty + qtyToRestore;

      await tx.stockLedger.update({
        where: { id: stock.id },
        data: {
          quantity: restoredQty,
          reservedQty: restoredReservedQty,
          isReserved: true,
        },
      });

      // Mark pallet position as occupied again
      await tx.palletPosition.update({
        where: { id: stock.palletPositionId },
        data: { isOccupied: true },
      });

      // 3. Create a reversal StockMovement
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          palletPositionId: item.palletPositionId,
          movementType: "inbound", // reversal treated as inbound
          quantity: qtyToRestore,
          quantityBefore: stock.quantity,
          quantityAfter: restoredQty,
          batchNumber: item.batchNumber,
          referenceType: "delivery_order_reversal",
          referenceId: doRecord.id,
        },
      });

      // 4. Reset picking item status back to pending
      await tx.dOPickingItem.update({
        where: { id: item.id },
        data: { pickedQty: 0, status: "pending", pickedById: null, pickedAt: null },
      });

      // 5. Reset DT item status back to pending
      await tx.deliveryTicketItem.update({
        where: { id: item.dtItemId },
        data: { deliveredQty: 0, status: "pending" },
      });

      // 6. If DO was marked delivered, revert it back to draft
      if (doRecord.status === "delivered") {
        await tx.deliveryOrder.update({
          where: { id: doRecord.id },
          data: {
            status: "draft",
            pickingCompletedAt: null,
            deliveredAt: null,
          },
        });

        await tx.deliveryTicket.update({
          where: { id: doRecord.deliveryTicketId },
          data: { status: "processing" },
        });
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/unpick-item error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
