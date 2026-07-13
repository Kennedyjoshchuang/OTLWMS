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
    const { stockLedgerId, targetPositionId, moveQty } = body;

    if (!stockLedgerId || !targetPositionId || moveQty === undefined || moveQty === null) {
      return NextResponse.json(
        { error: "stockLedgerId, targetPositionId, and moveQty are required." },
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

    // 1. Fetch source stock ledger details
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

    // 2. Fetch target position details
    const targetPosition = await prisma.palletPosition.findUnique({
      where: { id: targetPositionId },
    });

    if (!targetPosition) {
      return NextResponse.json({ error: "Target position not found." }, { status: 404 });
    }

    if (!targetPosition.isActive) {
      return NextResponse.json({ error: "Target position is inactive." }, { status: 400 });
    }

    if (sourcePositionId === targetPositionId) {
      return NextResponse.json({ error: "Source and target positions are the same." }, { status: 400 });
    }

    // Verify quantity bounds
    if (qtyToMove > sourceLedger.quantity) {
      return NextResponse.json(
        { error: `Cannot move ${qtyToMove} pcs. Only ${sourceLedger.quantity} pcs are in this location.` },
        { status: 400 }
      );
    }

    const isFullMove = qtyToMove === sourceLedger.quantity;

    // Run transaction
    await prisma.$transaction(async (tx) => {
      if (isFullMove) {
        // --- FULL MOVE ---
        // Update the existing StockLedger to point to the new position
        await tx.stockLedger.update({
          where: { id: stockLedgerId },
          data: { palletPositionId: targetPositionId },
        });

        // Update active (non-shipped) picking item references to the new position
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

        // Create StockMovement transfer entry
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
        // Verify we aren't moving reserved stock
        const availableQty = sourceLedger.quantity - (sourceLedger.reservedQty || 0);
        if (qtyToMove > availableQty) {
          throw new Error(
            `Cannot move ${qtyToMove} pcs. Only ${availableQty} pcs are unreserved and available to move.`
          );
        }

        // Deduct moved quantity from the source ledger
        const sizeLiter = sourceLedger.product.sizeLiter || 0;
        const remainingQty = sourceLedger.quantity - qtyToMove;
        
        await tx.stockLedger.update({
          where: { id: stockLedgerId },
          data: {
            quantity: remainingQty,
            quantityLiter: remainingQty * sizeLiter,
          },
        });

        // Create a new StockLedger record at the target position copying metadata
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

        // Create StockMovement transfer entry
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
      // 1. Source Position: check if any remaining stock is left
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

      // 2. Target Position: mark occupied
      await tx.palletPosition.update({
        where: { id: targetPositionId },
        data: { isOccupied: true },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/warehouse/move-item error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
