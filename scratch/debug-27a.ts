import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const productCode = "27A9BFBVA";
  const product = await prisma.product.findFirst({
    where: { productCode }
  });

  if (!product) return;

  console.log(`=== Product: ${product.productCode} ===`);

  // Receipts
  // Let's find ledgers referencing this product first, and get receipt details
  const ledgers = await prisma.stockLedger.findMany({
    where: { productId: product.id },
    include: { inboundReceipt: true }
  });

  console.log("\n--- Stock Ledgers ---");
  for (const sl of ledgers) {
    console.log(`- ID: ${sl.id}, Qty: ${sl.quantity}, Position: ${sl.palletPositionId}, Receipt: ${sl.inboundReceipt?.receiptNumber} (${sl.inboundReceiptId})`);
  }

  // Movements
  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "asc" }
  });

  console.log("\n--- Stock Movements ---");
  for (const m of movements) {
    console.log(`- ID: ${m.id}`);
    console.log(`  Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}`);
    console.log(`  Ref: ${m.referenceType} (${m.referenceId}), Date: ${m.createdAt}`);
    console.log(`  Notes: ${m.notes}`);
  }

  // Inbound Receipts
  const receipts = await prisma.inboundReceipt.findMany();
  console.log("\n--- Receipts with this product in stock ledgers ---");
  for (const r of receipts) {
    const sls = await prisma.stockLedger.findMany({
      where: { inboundReceiptId: r.id, productId: product.id }
    });
    if (sls.length > 0) {
      console.log(`- Receipt: ${r.receiptNumber}`);
      console.log(`  Total Pcs Received: ${r.totalPcsReceived}`);
      console.log(`  Total Liter Received: ${r.totalLiterReceived}`);
      console.log(`  Stock ledgers qty sum: ${sls.reduce((sum, sl) => sum + sl.quantity, 0)}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
