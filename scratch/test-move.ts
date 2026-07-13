import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== START WAREHOUSE ITEM MOVE VERIFICATION TEST ===");

  // 1. Find a source StockLedger with quantity > 1
  const sourceLedger = await prisma.stockLedger.findFirst({
    where: {
      quantity: { gt: 1 },
      // let's prefer unreserved if possible
      isReserved: false,
    },
    include: {
      palletPosition: true,
      product: true,
    },
  });

  if (!sourceLedger) {
    console.error("FAIL: Could not find any StockLedger with quantity > 1 to run tests.");
    return;
  }

  console.log(`Source StockLedger found: ID ${sourceLedger.id}`);
  console.log(`- Product: ${sourceLedger.product.productName} (${sourceLedger.product.productCode})`);
  console.log(`- Quantity: ${sourceLedger.quantity} pcs`);
  console.log(`- Position: ${sourceLedger.palletPosition.positionCode}`);

  // 2. Find an empty PalletPosition
  const targetPosition = await prisma.palletPosition.findFirst({
    where: {
      isOccupied: false,
      isActive: true,
    },
  });

  if (!targetPosition) {
    console.error("FAIL: Could not find any empty PalletPosition to use as move target.");
    return;
  }

  console.log(`Target empty position found: ${targetPosition.positionCode} (ID ${targetPosition.id})`);

  const initialSourceQty = sourceLedger.quantity;
  const initialSourcePositionId = sourceLedger.palletPositionId;
  const initialSourcePositionCode = sourceLedger.palletPosition.positionCode;
  const targetPositionId = targetPosition.id;

  try {
    // === TEST 1: PARTIAL MOVE ===
    console.log("\n--- Testing Partial Move (1 piece) ---");
    const qtyToMove = 1;

    // Run transaction simulating partial move
    await prisma.$transaction(async (tx) => {
      const sizeLiter = sourceLedger.product.sizeLiter || 0;
      const remainingQty = sourceLedger.quantity - qtyToMove;

      // Update source
      await tx.stockLedger.update({
        where: { id: sourceLedger.id },
        data: {
          quantity: remainingQty,
          quantityLiter: remainingQty * sizeLiter,
        },
      });

      // Create target ledger
      const newLedger = await tx.stockLedger.create({
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

      // Log movement
      await tx.stockMovement.create({
        data: {
          productId: sourceLedger.productId,
          palletPositionId: targetPositionId,
          movementType: "transfer",
          quantity: qtyToMove,
          quantityBefore: sourceLedger.quantity,
          quantityAfter: remainingQty,
          batchNumber: sourceLedger.batchNumber,
          notes: `[TEST] Partially moved ${qtyToMove} pcs from ${initialSourcePositionCode} to ${targetPosition.positionCode}`,
        },
      });

      // Set target occupied
      await tx.palletPosition.update({
        where: { id: targetPositionId },
        data: { isOccupied: true },
      });

      console.log("Partial move transaction executed successfully.");
    });

    // Assert database state after partial move
    const updatedSource = await prisma.stockLedger.findUnique({ where: { id: sourceLedger.id } });
    const targetLedger = await prisma.stockLedger.findFirst({
      where: { palletPositionId: targetPositionId, productId: sourceLedger.productId },
    });
    const updatedTargetPos = await prisma.palletPosition.findUnique({ where: { id: targetPositionId } });
    const partialMovementLog = await prisma.stockMovement.findFirst({
      where: { notes: { startsWith: "[TEST] Partially moved" } },
      orderBy: { createdAt: "desc" },
    });

    if (updatedSource?.quantity !== initialSourceQty - qtyToMove) {
      throw new Error(`Assert failed: Source quantity should be ${initialSourceQty - qtyToMove}, got ${updatedSource?.quantity}`);
    }
    if (targetLedger?.quantity !== qtyToMove) {
      throw new Error(`Assert failed: Target ledger quantity should be ${qtyToMove}, got ${targetLedger?.quantity}`);
    }
    if (!updatedTargetPos?.isOccupied) {
      throw new Error("Assert failed: Target position should be occupied.");
    }
    if (!partialMovementLog) {
      throw new Error("Assert failed: StockMovement log for partial transfer was not found.");
    }
    console.log("SUCCESS: Partial move assertions passed!");

    // === TEST 2: FULL MOVE ===
    console.log("\n--- Testing Full Move (Remaining pieces) ---");
    const remainingQtyToMove = updatedSource.quantity;

    await prisma.$transaction(async (tx) => {
      // Update the existing StockLedger to point to the new position
      await tx.stockLedger.update({
        where: { id: sourceLedger.id },
        data: { palletPositionId: targetPositionId },
      });

      // Create StockMovement transfer entry
      await tx.stockMovement.create({
        data: {
          productId: sourceLedger.productId,
          palletPositionId: targetPositionId,
          movementType: "transfer",
          quantity: remainingQtyToMove,
          quantityBefore: remainingQtyToMove,
          quantityAfter: remainingQtyToMove,
          batchNumber: sourceLedger.batchNumber,
          notes: `[TEST] Fully moved ${remainingQtyToMove} pcs from ${initialSourcePositionCode} to ${targetPosition.positionCode}`,
        },
      });

      // Update source position isOccupied status
      const remainingSourceStock = await tx.stockLedger.count({
        where: {
          palletPositionId: initialSourcePositionId,
          quantity: { gt: 0 },
        },
      });

      if (remainingSourceStock === 0) {
        await tx.palletPosition.update({
          where: { id: initialSourcePositionId },
          data: { isOccupied: false },
        });
      }

      console.log("Full move transaction executed successfully.");
    });

    // Assert database state after full move
    const finalSource = await prisma.stockLedger.findUnique({ where: { id: sourceLedger.id } });
    const finalSourcePos = await prisma.palletPosition.findUnique({ where: { id: initialSourcePositionId } });
    const fullMovementLog = await prisma.stockMovement.findFirst({
      where: { notes: { startsWith: "[TEST] Fully moved" } },
      orderBy: { createdAt: "desc" },
    });

    if (finalSource?.palletPositionId !== targetPositionId) {
      throw new Error(`Assert failed: Source ledger should now reside at targetPositionId ${targetPositionId}`);
    }
    if (finalSourcePos?.isOccupied) {
      throw new Error("Assert failed: Source position should now be empty and unoccupied.");
    }
    if (!fullMovementLog) {
      throw new Error("Assert failed: StockMovement log for full transfer was not found.");
    }
    console.log("SUCCESS: Full move assertions passed!");

    // === CLEANUP / ROLLBACK ===
    console.log("\n--- Cleaning up test records ---");
    await prisma.$transaction(async (tx) => {
      // 1. Delete target ledger created in partial move
      if (targetLedger) {
        await tx.stockLedger.delete({ where: { id: targetLedger.id } });
      }
      
      // 2. Move original ledger back to its starting position
      await tx.stockLedger.update({
        where: { id: sourceLedger.id },
        data: {
          palletPositionId: initialSourcePositionId,
          quantity: initialSourceQty,
          quantityLiter: initialSourceQty * (sourceLedger.product.sizeLiter || 0),
        },
      });

      // 3. Delete testing movement logs
      await tx.stockMovement.deleteMany({
        where: {
          notes: { startsWith: "[TEST]" },
        },
      });

      // 4. Restore original occupancy
      await tx.palletPosition.update({
        where: { id: initialSourcePositionId },
        data: { isOccupied: true },
      });

      await tx.palletPosition.update({
        where: { id: targetPositionId },
        data: { isOccupied: false },
      });
    });
    console.log("Cleanup completed successfully. Database reverted to initial state.");
    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");

  } catch (err: any) {
    console.error("\nFAIL: Test threw an error:", err);
    // Attempt cleanup in case of failure
    try {
      console.log("Attempting cleanup/recovery...");
      const targetLedgerToDelete = await prisma.stockLedger.findFirst({
        where: { palletPositionId: targetPositionId, productId: sourceLedger.productId },
      });
      if (targetLedgerToDelete) {
        await prisma.stockLedger.delete({ where: { id: targetLedgerToDelete.id } });
      }
      await prisma.stockLedger.update({
        where: { id: sourceLedger.id },
        data: {
          palletPositionId: initialSourcePositionId,
          quantity: initialSourceQty,
        },
      });
      await prisma.palletPosition.update({
        where: { id: initialSourcePositionId },
        data: { isOccupied: true },
      });
      await prisma.palletPosition.update({
        where: { id: targetPositionId },
        data: { isOccupied: false },
      });
      await prisma.stockMovement.deleteMany({
        where: { notes: { startsWith: "[TEST]" } },
      });
      console.log("Recovery cleanup done.");
    } catch (cleanErr) {
      console.error("Recovery cleanup failed:", cleanErr);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
