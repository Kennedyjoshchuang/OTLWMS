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

    const updatedDO = await prisma.$transaction(async (tx) => {
      // 1. Fetch the DO and the picking item
      const doRecord = await tx.deliveryOrder.findUnique({
        where: { id },
        include: { pickingItems: true },
      });

      if (!doRecord) throw new Error("Delivery Order not found.");

      const item = doRecord.pickingItems.find((p) => p.id === pickingItemId);
      if (!item) throw new Error("Picking item not found in this Delivery Order.");

      if (item.status === "shipped") {
        throw new Error("Item has already been picked.");
      }

      // 2. Fetch the stock ledger
      const stock = await tx.stockLedger.findUnique({
        where: { id: item.stockLedgerId },
      });

      if (!stock) throw new Error("Stock location not found.");

      // 3. Deduct stock
      const qtyPicked = item.requiredQty;
      const newQty = Math.max(0, stock.quantity - qtyPicked);
      const newReservedQty = Math.max(0, stock.reservedQty - qtyPicked);

      await tx.stockLedger.update({
        where: { id: stock.id },
        data: {
          quantity: newQty,
          reservedQty: newReservedQty,
          isReserved: newReservedQty > 0,
        },
      });

      // Free up PalletPosition if stock reaches 0
      if (newQty === 0) {
        const remainingStockInPos = await tx.stockLedger.count({
          where: {
            palletPositionId: stock.palletPositionId,
            id: { not: stock.id },
            quantity: { gt: 0 },
          },
        });

        if (remainingStockInPos === 0) {
          await tx.palletPosition.update({
            where: { id: stock.palletPositionId },
            data: { isOccupied: false },
          });
        }
      }

      // 4. Create Stock Movement log
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          palletPositionId: item.palletPositionId,
          movementType: "outbound",
          quantity: qtyPicked,
          quantityBefore: stock.quantity,
          quantityAfter: newQty,
          batchNumber: item.batchNumber,
          referenceType: "delivery_order",
          referenceId: doRecord.id,
        },
      });

      // 5. Update picking item
      await tx.dOPickingItem.update({
        where: { id: item.id },
        data: { pickedQty: qtyPicked, status: "shipped" },
      });

      await tx.deliveryTicketItem.update({
        where: { id: item.dtItemId },
        data: { deliveredQty: qtyPicked, status: "delivered" },
      });

      // 6. Check if all items are shipped
      const allItems = await tx.dOPickingItem.findMany({
        where: { deliveryOrderId: doRecord.id },
      });

      const allShipped = allItems.every((p) => p.status === "shipped");

      if (allShipped) {
        await tx.deliveryOrder.update({
          where: { id: doRecord.id },
          data: {
            status: "delivered",
            pickingCompletedAt: new Date(),
            deliveredAt: new Date(),
          },
        });

        await tx.deliveryTicket.update({
          where: { id: doRecord.deliveryTicketId },
          data: { status: "delivered" },
        });
      }

      return tx.deliveryOrder.findUnique({
        where: { id },
        include: { pickingItems: true },
      });
    });

    return NextResponse.json({ success: true, deliveryOrder: updatedDO }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/pick-item error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
