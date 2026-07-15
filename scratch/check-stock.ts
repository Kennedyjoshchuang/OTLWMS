import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Verifying StockLedgers...");
  const stockLedgers = await prisma.stockLedger.findMany({
    include: { product: true }
  });

  let sumCalculatedLiter = 0;
  let sumStoredQuantityLiter = 0;
  let mismatchCount = 0;

  for (const sl of stockLedgers) {
    const size = sl.product?.sizeLiter || 0;
    const calc = sl.quantity * size;
    sumCalculatedLiter += calc;
    sumStoredQuantityLiter += sl.quantityLiter;

    if (Math.abs(calc - sl.quantityLiter) > 0.001) {
      mismatchCount++;
    }
  }

  console.log("\nVerification Summary:");
  console.log(`Total StockLedger rows: ${stockLedgers.length}`);
  console.log(`Total Mismatches: ${mismatchCount}`);
  console.log(`Sum of calculated Liter (qty * size): ${sumCalculatedLiter}`);
  console.log(`Sum of stored quantityLiter: ${sumStoredQuantityLiter}`);
  
  if (mismatchCount === 0) {
    console.log("SUCCESS: Database is consistent and clean!");
  } else {
    console.log("FAILURE: Inconsistencies still found!");
  }
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
