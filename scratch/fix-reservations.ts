import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting stock ledger reservations repair...");

  const stockLedgers = await prisma.stockLedger.findMany({
    include: {
      product: true,
      palletPosition: true,
      pickingItems: {
        include: {
          deliveryOrder: true,
        },
      },
    },
  });

  let repairedCount = 0;

  for (const sl of stockLedgers) {
    // Sum of requiredQty for pending picking items
    const pendingPickingQty = sl.pickingItems
      .filter((pi) => pi.status === "pending")
      .reduce((sum, pi) => sum + pi.requiredQty, 0);

    if (sl.reservedQty !== pendingPickingQty) {
      repairedCount++;
      console.log(`\nRepairing StockLedger ID: ${sl.id}`);
      console.log(`   Product: ${sl.product.productCode} (${sl.product.productName})`);
      console.log(`   Location: ${sl.palletPosition.positionCode}`);
      console.log(`   Old reservedQty: ${sl.reservedQty}`);
      console.log(`   New reservedQty: ${pendingPickingQty}`);

      // Perform update
      await prisma.stockLedger.update({
        where: { id: sl.id },
        data: {
          reservedQty: pendingPickingQty,
          isReserved: pendingPickingQty > 0,
        },
      });
    }
  }

  console.log(`\nRepair completed successfully.`);
  console.log(`Total stock ledger entries repaired: ${repairedCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
