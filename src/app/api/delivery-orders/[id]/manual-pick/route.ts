import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { dtItemId, stockLedgerId, quantity } = body;

    if (!dtItemId || !stockLedgerId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: "dtItemId, stockLedgerId, and a positive quantity are required." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate DO
      const doRecord = await tx.deliveryOrder.findUnique({ where: { id } });
      if (!doRecord) throw new Error("Delivery Order not found.");

      // 2. Validate stock ledger
      const stock = await tx.stockLedger.findUnique({
        where: { id: stockLedgerId },
        include: { palletPosition: true },
      });
      if (!stock) throw new Error("Stock location not found.");

      // Calculate how much of the reservedQty belongs to THIS DO (so we can pick it freely)
      const thisDoReserved = await tx.dOPickingItem.aggregate({
        where: { deliveryOrderId: id, stockLedgerId, status: "pending" },
        _sum: { requiredQty: true },
      });
      const reservedByThisDO = thisDoReserved._sum.requiredQty ?? 0;
      const otherReservations = Math.max(0, (stock.reservedQty ?? 0) - reservedByThisDO);
      const effectiveAvailable = Math.max(0, stock.quantity - otherReservations);

      if (quantity > effectiveAvailable) {
        throw new Error(`Stok tidak cukup. Tersedia untuk DO ini: ${effectiveAvailable} pcs.`);
      }

      // 3. Validate DT item belongs to this DO's DT
      const dtItem = await tx.deliveryTicketItem.findUnique({ where: { id: dtItemId } });
      if (!dtItem) throw new Error("Delivery Ticket item not found.");

      // 4. Deduct stock
      const newQty = stock.quantity - quantity;
      const newReservedQty = Math.max(0, stock.reservedQty - quantity);

      await tx.stockLedger.update({
        where: { id: stock.id },
        data: {
          quantity: newQty,
          reservedQty: newReservedQty,
          isReserved: newReservedQty > 0,
        },
      });

      // Free pallet position if empty
      if (newQty === 0) {
        const otherStock = await tx.stockLedger.count({
          where: { palletPositionId: stock.palletPositionId, id: { not: stock.id }, quantity: { gt: 0 } },
        });
        if (otherStock === 0) {
          await tx.palletPosition.update({ where: { id: stock.palletPositionId }, data: { isOccupied: false } });
        }
      }

      // 5. Create a new DOPickingItem record (manual pick)
      const newPickingItem = await tx.dOPickingItem.create({
        data: {
          deliveryOrderId: id,
          dtItemId,
          productId: dtItem.productId!,
          stockLedgerId: stock.id,
          palletPositionId: stock.palletPositionId,
          positionCode: stock.palletPosition.positionCode,
          batchNumber: stock.batchNumber,
          requiredQty: quantity,
          pickedQty: quantity,
          status: "shipped",
        },
        include: { product: true },
      });

      // 6. Create StockMovement
      await tx.stockMovement.create({
        data: {
          productId: dtItem.productId!,
          palletPositionId: stock.palletPositionId,
          movementType: "outbound",
          quantity,
          quantityBefore: stock.quantity,
          quantityAfter: newQty,
          batchNumber: stock.batchNumber,
          referenceType: "delivery_order",
          referenceId: id,
        },
      });

      // 7. Update DTItem deliveredQty
      const allPickedForItem = await tx.dOPickingItem.aggregate({
        where: { deliveryOrderId: id, dtItemId, status: "shipped" },
        _sum: { pickedQty: true },
      });
      const totalPicked = allPickedForItem._sum.pickedQty ?? 0;

      await tx.deliveryTicketItem.update({
        where: { id: dtItemId },
        data: {
          deliveredQty: totalPicked,
          status: totalPicked >= dtItem.delQtyPcs ? "delivered" : "pending",
        },
      });

      // 8. Check if all DT items are fulfilled
      const allDTItems = await tx.deliveryTicketItem.findMany({
        where: { deliveryTicketId: doRecord.deliveryTicketId },
      });
      const allFulfilled = allDTItems.every((i) => (i.deliveredQty ?? 0) >= i.delQtyPcs);

      if (allFulfilled) {
        await tx.deliveryOrder.update({
          where: { id },
          data: { status: "delivered", pickingCompletedAt: new Date(), deliveredAt: new Date() },
        });
        await tx.deliveryTicket.update({
          where: { id: doRecord.deliveryTicketId },
          data: { status: "delivered" },
        });
      }

      return { newPickingItem, allFulfilled };
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/manual-pick error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
