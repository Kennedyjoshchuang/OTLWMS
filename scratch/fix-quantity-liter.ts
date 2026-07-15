import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Aligning quantityLiter in StockLedger database...");
  const stockLedgers = await prisma.stockLedger.findMany({
    include: { product: true }
  });

  let fixedCount = 0;

  for (const sl of stockLedgers) {
    const size = sl.product?.sizeLiter || 0;
    const expectedLiter = sl.quantity * size;

    if (Math.abs(expectedLiter - sl.quantityLiter) > 0.001) {
      console.log(`Fixing StockLedger ID: ${sl.id}`);
      console.log(`  Product: ${sl.product.productCode} (${sl.product.productName})`);
      console.log(`  Quantity (pcs): ${sl.quantity}`);
      console.log(`  Old quantityLiter: ${sl.quantityLiter}`);
      console.log(`  New quantityLiter: ${expectedLiter}`);

      await prisma.stockLedger.update({
        where: { id: sl.id },
        data: { quantityLiter: expectedLiter }
      });
      fixedCount++;
    }
  }

  console.log(`\nCleanup Completed! Fixed ${fixedCount} StockLedger entries.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
