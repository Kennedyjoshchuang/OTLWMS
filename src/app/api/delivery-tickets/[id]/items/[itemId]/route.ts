import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roundFloat } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: ticketId, itemId } = await params;
    const body = await req.json();
    const { productId, delQtyPcs, lotBatchNo } = body;

    if (delQtyPcs === undefined || delQtyPcs <= 0) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    // 1. Fetch DTItem
    const dtItem = await prisma.deliveryTicketItem.findUnique({
      where: { id: itemId },
      include: {
        pickingItems: true,
        deliveryTicket: {
          include: {
            deliveryOrders: true,
          }
        }
      }
    });

    if (!dtItem || dtItem.deliveryTicketId !== ticketId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // 2. Check if already picked
    const totalPicked = dtItem.pickingItems.reduce((sum, pi) => sum + (pi.pickedQty ?? 0), 0);
    if ((dtItem.deliveredQty ?? 0) > 0 || totalPicked > 0) {
      return NextResponse.json({ error: "Cannot edit item. It has already been partially or fully picked." }, { status: 400 });
    }

    // 3. Process database transaction
    await prisma.$transaction(async (tx) => {
      // Get the target product info
      const targetProductId = productId || dtItem.productId;
      if (!targetProductId) {
        throw new Error("No product ID specified");
      }

      const product = await tx.product.findUnique({
        where: { id: targetProductId },
      });

      if (!product) {
        throw new Error("Product not found");
      }

      // Recalculate sizeLiter and weightKg
      const delQtyLiter = product.sizeLiter ? roundFloat(delQtyPcs * product.sizeLiter, 2) : null;
      const delQtyKg = product.weightKg ? roundFloat(delQtyPcs * product.weightKg, 2) : null;

      // Check if there are active pickingItems (which must have pickedQty = 0)
      if (dtItem.pickingItems.length > 0) {
        // a. Release reservations on StockLedger for all old pickingItems
        for (const pi of dtItem.pickingItems) {
          const stock = await tx.stockLedger.findUnique({
            where: { id: pi.stockLedgerId },
          });
          if (stock) {
            const newReserved = Math.max(0, stock.reservedQty - pi.requiredQty);
            await tx.stockLedger.update({
              where: { id: stock.id },
              data: {
                reservedQty: newReserved,
                isReserved: newReserved > 0,
              }
            });
          }
        }

        // b. Delete old pickingItems
        await tx.dOPickingItem.deleteMany({
          where: { dtItemId: itemId }
        });
      }

      // c. Update DeliveryTicketItem
      await tx.deliveryTicketItem.update({
        where: { id: itemId },
        data: {
          productId: targetProductId,
          productCode: product.productCode,
          productName: product.productName,
          delQtyPcs,
          delQtyLiter,
          delQtyKg,
          lotBatchNo: lotBatchNo !== undefined ? lotBatchNo : dtItem.lotBatchNo,
        }
      });

      // d. Recalculate totals for DeliveryTicket
      const allItems = await tx.deliveryTicketItem.findMany({
        where: { deliveryTicketId: ticketId }
      });
      const totalPcs = allItems.reduce((sum, i) => sum + i.delQtyPcs, 0);
      const totalLiter = roundFloat(allItems.reduce((sum, i) => sum + (i.delQtyLiter ?? 0), 0), 2);
      
      await tx.deliveryTicket.update({
        where: { id: ticketId },
        data: {
          totalPcs,
          totalLiter,
          totalGrossKg: roundFloat(totalLiter * 1.3, 2), // follow existing business logic
        }
      });

      // e. If there were DOs (pickingItems existed), re-allocate reservations for this product
      // We group the deleted pickingItems by deliveryOrderId
      const doIds = Array.from(new Set(dtItem.pickingItems.map(pi => pi.deliveryOrderId)));
      for (const doId of doIds) {
        let requiredQty = delQtyPcs;

        // Fetch available stock entries for the product
        const allStockEntries = await tx.stockLedger.findMany({
          where: {
            productId: targetProductId,
            quantity: { gt: 0 },
          },
          orderBy: { inboundDate: "asc" },
          include: { palletPosition: true },
        });

        for (const stock of allStockEntries) {
          if (requiredQty <= 0) break;

          const available = stock.quantity - stock.reservedQty;
          if (available <= 0) continue;

          const qtyToPick = Math.min(requiredQty, available);

          // Update reserved quantity in DB
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              reservedQty: stock.reservedQty + qtyToPick,
              isReserved: true,
            }
          });

          // Create new DOPickingItem
          await tx.dOPickingItem.create({
            data: {
              deliveryOrderId: doId,
              dtItemId: itemId,
              productId: targetProductId,
              stockLedgerId: stock.id,
              palletPositionId: stock.palletPositionId,
              positionCode: stock.palletPosition.positionCode,
              batchNumber: stock.batchNumber,
              requiredQty: qtyToPick,
              status: "pending",
            }
          });

          requiredQty -= qtyToPick;
        }

        if (requiredQty > 0) {
          console.warn(`Shortage for product ${product.productCode} after edit: ${requiredQty} pcs unfulfilled.`);
        }
      }
    }, {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/delivery-tickets/[id]/items/[itemId] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
