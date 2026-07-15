import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill of inbound StockMovement records...");

  const receipts = await prisma.inboundReceipt.findMany({
    include: {
      stockLedgers: true
    }
  });

  let createdCount = 0;
  let skippedCount = 0;

  for (const receipt of receipts) {
    console.log(`Processing receipt: ${receipt.receiptNumber}...`);
    for (const sl of receipt.stockLedgers) {
      // Check if a movement already exists for this ledger entry
      const existing = await prisma.stockMovement.findFirst({
        where: {
          movementType: "inbound",
          referenceType: "inbound_receipt",
          referenceId: receipt.id,
          productId: sl.productId,
          palletPositionId: sl.palletPositionId,
        }
      });

      if (existing) {
        skippedCount++;
        continue;
      }

      // Create StockMovement
      await prisma.stockMovement.create({
        data: {
          productId: sl.productId,
          palletPositionId: sl.palletPositionId,
          movementType: "inbound",
          quantity: sl.quantity,
          quantityBefore: 0,
          quantityAfter: sl.quantity,
          batchNumber: sl.batchNumber,
          referenceType: "inbound_receipt",
          referenceId: receipt.id,
          notes: "Backfilled inbound stock movement",
          createdAt: receipt.receivedDate || receipt.createdAt || new Date(),
        }
      });
      createdCount++;
    }
  }

  console.log("\nBackfill Completed!");
  console.log(`Created StockMovements: ${createdCount}`);
  console.log(`Skipped (already exist): ${skippedCount}`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
