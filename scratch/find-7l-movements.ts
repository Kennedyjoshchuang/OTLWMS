import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing inbound movements without matching receipt...");

  const movements = await prisma.stockMovement.findMany({
    where: { movementType: "inbound" },
    include: { product: true }
  });

  const receipts = await prisma.inboundReceipt.findMany();
  const receiptIds = new Set(receipts.map(r => r.id));

  let unlinkedPcs = 0;
  let unlinkedLiters = 0;

  for (const m of movements) {
    const hasReceipt = m.referenceType === "inbound_receipt" && m.referenceId && receiptIds.has(m.referenceId);
    
    if (!hasReceipt) {
      const size = m.product?.sizeLiter || 0;
      const liters = m.quantity * size;
      unlinkedPcs += m.quantity;
      unlinkedLiters += liters;

      console.log(`Unlinked Inbound Movement:`);
      console.log(`  ID: ${m.id}`);
      console.log(`  Product Code: ${m.product?.productCode}`);
      console.log(`  Qty: ${m.quantity} pcs (${liters} L)`);
      console.log(`  Ref Type: ${m.referenceType}, Ref ID: ${m.referenceId}`);
      console.log(`  Notes: ${m.notes}`);
      console.log(`  Date: ${m.createdAt}`);
    }
  }

  console.log("\nSummary:");
  console.log(`  Total Unlinked Pcs: ${unlinkedPcs}`);
  console.log(`  Total Unlinked Liters: ${unlinkedLiters} L`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
