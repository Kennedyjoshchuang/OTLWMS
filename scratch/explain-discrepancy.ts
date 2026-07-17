import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const code = "6BYMAWCMF";
  const product = await prisma.product.findFirst({ where: { productCode: code } });
  if (!product) {
    console.log(`Product ${code} not found`);
    return;
  }

  console.log(`=== All StockLedger records for ${code} ===`);
  const ledgers = await prisma.stockLedger.findMany({
    where: { productId: product.id },
    include: { palletPosition: true }
  });
  for (const l of ledgers) {
    console.log(`Ledger ID: ${l.id}, Qty: ${l.quantity}, InboundDate: ${l.inboundDate.toISOString()}, Pos: ${l.palletPosition?.positionCode}, Created: ${l.createdAt.toISOString()}`);
  }

  console.log(`\n=== All StockMovement records for ${code} ===`);
  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "asc" }
  });
  for (const m of movements) {
    console.log(`Movement ID: ${m.id}, Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}, Created: ${m.createdAt.toISOString()}, PosId: ${m.palletPositionId}, Notes: ${m.notes}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
