import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasWriteAccess } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canWrite = hasWriteAccess(session.user as any, "/dashboard/warehouse");
    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden — You do not have write access to this page." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { stockLedgerId, targetPositionId, moveQty, productId, sourcePositionId } = body;

    if (!targetPositionId) {
      return NextResponse.json(
        { error: "targetPositionId is required." },
        { status: 400 }
      );
    }

    // Fetch target position details
    const targetPosition = await prisma.palletPosition.findUnique({
      where: { id: targetPositionId },
    });

    if (!targetPosition) {
      return NextResponse.json({ error: "Target position not found." }, { status: 404 });
    }

    if (!targetPosition.isActive) {
      return NextResponse.json({ error: "Target position is inactive." }, { status: 400 });
    }

    const isCollectionMove = !!productId && !!sourcePositionId;

    if (isCollectionMove) {
      // --- BULK / COLLECTION MOVE ---
      if (sourcePositionId === targetPositionId) {
        return NextResponse.json({ error: "Source and target positions are the same." }, { status: 400 });
      }

      // Fetch all active stock ledgers of this product at this position
      const ledgers = await prisma.stockLedger.findMany({
        where: {
          palletPositionId: sourcePositionId,
          productId,
          quantity: { gt: 0 }
        },
        include: {
          product: true,
          palletPosition: true,
        }
      });

      if (ledgers.length === 0) {
        return NextResponse.json({ error: "No active stock found for this product at this position." }, { status: 404 });
      }

      const totalQtyMoved = ledgers.reduce((sum, sl) => sum + sl.quantity, 0);
      const ledgerIds = ledgers.map(l => l.id);
      const sourcePositionCode = ledgers[0].palletPosition.positionCode;

      await prisma.$transaction(async (tx) => {
        // 1. Update all stock ledgers to the target position
        await tx.stockLedger.updateMany({
          where: { id: { in: ledgerIds } },
          data: { palletPositionId: targetPositionId }
        });

        // 2. Update active (non-shipped) picking item references to the new position
        await tx.dOPickingItem.updateMany({
          where: {
            stockLedgerId: { in: ledgerIds },
            status: { not: "shipped" }
          },
          data: {
            palletPositionId: targetPositionId,
            positionCode: targetPosition.positionCode
          }
        });

        // 3. Create a single StockMovement transfer entry for the collection
        await tx.stockMovement.create({
          data: {
            productId,
            palletPositionId: targetPositionId,
            movementType: "transfer",
            quantity: totalQtyMoved,
            quantityBefore: totalQtyMoved,
            quantityAfter: totalQtyMoved,
            notes: `Moved collection of ${ledgers.length} stock records (${totalQtyMoved} pcs) from ${sourcePositionCode} to ${targetPosition.positionCode}`,
            performedById: (session.user as any)?.id || null,
          }
        });

        // --- OCCUPANCY ADJUSTMENT ---
        // 1. Source Position
        const remainingSourceStock = await tx.stockLedger.count({
          where: {
            palletPositionId: sourcePositionId,
            quantity: { gt: 0 }
          }
        });
        if (remainingSourceStock === 0) {
          await tx.palletPosition.update({
            where: { id: sourcePositionId },
            data: { isOccupied: false }
          });
        }

        // 2. Target Position
        await tx.palletPosition.update({
          where: { id: targetPositionId },
          data: { isOccupied: true }
        });
      });

      return NextResponse.json({ success: true });

    } else {
      // --- STANDARD SINGLE MOVE ---
      if (!stockLedgerId || moveQty === undefined || moveQty === null) {
        return NextResponse.json(
          { error: "stockLedgerId and moveQty are required for single move." },
          { status: 400 }
        );
      }

      const qtyToMove = Number(moveQty);
      if (isNaN(qtyToMove) || qtyToMove <= 0) {
        return NextResponse.json(
          { error: "moveQty must be a positive number." },
          { status: 400 }
        );
      }

      // Fetch source stock ledger details
      const sourceLedger = await prisma.stockLedger.findUnique({
        where: { id: stockLedgerId },
        include: {
          palletPosition: true,
          product: true,
        },
      });

      if (!sourceLedger) {
        return NextResponse.json({ error: "Source stock ledger not found." }, { status: 404 });
      }

      const sourcePositionId = sourceLedger.palletPositionId;
      const sourcePositionCode = sourceLedger.palletPosition.positionCode;

      if (sourcePositionId === targetPositionId) {
        return NextResponse.json({ error: "Source and target positions are the same." }, { status: 400 });
      }

      if (qtyToMove > sourceLedger.quantity) {
        return NextResponse.json(
          { error: `Cannot move ${qtyToMove} pcs. Only ${sourceLedger.quantity} pcs are in this location.` },
          { status: 400 }
        );
      }

      const isFullMove = qtyToMove === sourceLedger.quantity;

      await prisma.$transaction(async (tx) => {
        const sizeLiter = sourceLedger.product.sizeLiter || 0;

        if (isFullMove) {
          // --- FULL MOVE ---
          await tx.stockLedger.update({
            where: { id: stockLedgerId },
            data: { palletPositionId: targetPositionId },
          });

          await tx.dOPickingItem.updateMany({
            where: {
              stockLedgerId: stockLedgerId,
              status: { not: "shipped" },
            },
            data: {
              palletPositionId: targetPositionId,
              positionCode: targetPosition.positionCode,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: sourceLedger.productId,
              palletPositionId: targetPositionId,
              movementType: "transfer",
              quantity: qtyToMove,
              quantityBefore: sourceLedger.quantity,
              quantityAfter: sourceLedger.quantity,
              batchNumber: sourceLedger.batchNumber,
              notes: `Fully moved ${qtyToMove} pcs from ${sourcePositionCode} to ${targetPosition.positionCode}`,
              performedById: (session.user as any)?.id || null,
            },
          });
        } else {
          // --- PARTIAL MOVE ---
          const availableQty = sourceLedger.quantity - (sourceLedger.reservedQty || 0);
          if (qtyToMove > availableQty) {
            throw new Error(
              `Cannot move ${qtyToMove} pcs. Only ${availableQty} pcs are unreserved and available to move.`
            );
          }

          const remainingQty = sourceLedger.quantity - qtyToMove;

          await tx.stockLedger.update({
            where: { id: stockLedgerId },
            data: {
              quantity: remainingQty,
              quantityLiter: remainingQty * sizeLiter,
            },
          });

          await tx.stockLedger.create({
            data: {
              productId: sourceLedger.productId,
              palletPositionId: targetPositionId,
              batchNumber: sourceLedger.batchNumber,
              quantity: qtyToMove,
              quantityLiter: qtyToMove * sizeLiter,
              inboundDate: sourceLedger.inboundDate,
              inboundReceiptId: sourceLedger.inboundReceiptId,
              isReserved: false,
              reservedQty: 0,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: sourceLedger.productId,
              palletPositionId: targetPositionId,
              movementType: "transfer",
              quantity: qtyToMove,
              quantityBefore: sourceLedger.quantity,
              quantityAfter: remainingQty,
              batchNumber: sourceLedger.batchNumber,
              notes: `Partially moved ${qtyToMove} pcs from ${sourcePositionCode} to ${targetPosition.positionCode}`,
              performedById: (session.user as any)?.id || null,
            },
          });
        }

        // --- OCCUPANCY ADJUSTMENT ---
        const remainingSourceStock = await tx.stockLedger.count({
          where: {
            palletPositionId: sourcePositionId,
            quantity: { gt: 0 },
          },
        });

        if (remainingSourceStock === 0) {
          await tx.palletPosition.update({
            where: { id: sourcePositionId },
            data: { isOccupied: false },
          });
        }

        await tx.palletPosition.update({
          where: { id: targetPositionId },
          data: { isOccupied: true },
        });
      });

      return NextResponse.json({ success: true });
    }

  } catch (error: any) {
    console.error("POST /api/warehouse/move-item error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
