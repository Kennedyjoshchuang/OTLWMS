import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { roundFloat } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as any)?.id;

    const { id } = await params;

    // Run in a transaction
    const deliveryOrder = await prisma.$transaction(async (tx) => {
      // Lock DO row to prevent concurrent double-processing
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DeliveryOrder" WHERE id = ${id} FOR UPDATE`
      );

      // 1. Fetch DO
      const doRecord = await tx.deliveryOrder.findUnique({
        where: { id },
        include: { pickingItems: true },
      });

      if (!doRecord) {
        throw new Error("Delivery Order not found.");
      }

      if (doRecord.status === "delivered" || doRecord.status === "shipped") {
        throw new Error("Delivery Order is already processed.");
      }

      // Lock all affected stock ledgers
      const stockIds = Array.from(
        new Set(
          doRecord.pickingItems
            .filter((p) => p.status !== "shipped")
            .map((p) => p.stockLedgerId)
        )
      );
      if (stockIds.length > 0) {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "StockLedger" WHERE id IN (${Prisma.join(stockIds)}) FOR UPDATE`
        );
      }

      // 2. Process each picking item
      for (const item of doRecord.pickingItems) {
        if (item.status === "shipped") continue;

        // Fetch current stock ledger
        const stock = await tx.stockLedger.findUnique({
          where: { id: item.stockLedgerId },
          include: { product: true }
        });

        if (!stock) {
          throw new Error(`Stock record not found for position ${item.positionCode}.`);
        }

        const qtyPicked = item.requiredQty;
        if (stock.quantity < qtyPicked) {
          throw new Error(
            `Insufficient physical stock at position ${item.positionCode} for product ${stock.product?.productCode || item.productId}. Available: ${stock.quantity}, Required: ${qtyPicked}. Please reallocate before completing.`
          );
        }

        const newQty = stock.quantity - qtyPicked;
        const newReservedQty = Math.max(0, stock.reservedQty - qtyPicked);
        const sizeLiter = stock.product?.sizeLiter || 0;
        const newQtyLiter = roundFloat(newQty * sizeLiter, 2);

        // Update StockLedger
        await tx.stockLedger.update({
          where: { id: stock.id },
          data: {
            quantity: newQty,
            quantityLiter: newQtyLiter,
            reservedQty: newReservedQty,
            isReserved: newReservedQty > 0,
          },
        });

        // If stock reaches 0, free up PalletPosition
        if (newQty === 0) {
          // Check if any other stock ledger occupies this position
          const remainingStockInPos = await tx.stockLedger.count({
            where: {
              palletPositionId: stock.palletPositionId,
              id: { not: stock.id },
              quantity: { gt: 0 },
            }
          });

          if (remainingStockInPos === 0) {
             await tx.palletPosition.update({
               where: { id: stock.palletPositionId },
               data: { isOccupied: false }
             });
          }
        }

        // Create Stock Movement log
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

        // Update DOPickingItem
        await tx.dOPickingItem.update({
          where: { id: item.id },
          data: { pickedQty: qtyPicked, status: "shipped", pickedById: userId, pickedAt: new Date() },
        });
        
        // Update DTItem
        await tx.deliveryTicketItem.update({
          where: { id: item.dtItemId },
          data: { deliveredQty: qtyPicked, status: "delivered" }
        })
      }

      // 3. Update DO status
      const updatedDO = await tx.deliveryOrder.update({
        where: { id: doRecord.id },
        data: {
          status: "delivered",
          pickingCompletedAt: new Date(),
          deliveredAt: new Date(),
        },
      });

      // 4. Update DT status
      await tx.deliveryTicket.update({
        where: { id: doRecord.deliveryTicketId },
        data: { status: "delivered" },
      });

      return updatedDO;
    });

    return NextResponse.json({ success: true, deliveryOrder }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/process error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
