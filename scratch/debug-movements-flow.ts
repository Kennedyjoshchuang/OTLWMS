import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const productCode = "6ZJMAWUVA";
  const product = await prisma.product.findFirst({
    where: { productCode }
  });

  if (!product) return;

  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "asc" }
  });

  console.log(`=== Stock Movements for ${productCode} ===`);
  for (const m of movements) {
    console.log(`- Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}`);
    console.log(`  Position: ${m.palletPositionId}, Ref: ${m.referenceType} (${m.referenceId})`);
    console.log(`  Date: ${m.createdAt.toISOString()} (CUID: ${m.id})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
