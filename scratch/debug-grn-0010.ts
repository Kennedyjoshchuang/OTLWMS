import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const receipt = await prisma.inboundReceipt.findFirst({
    where: { receiptNumber: "GRN-2026-0010" }
  });

  if (!receipt) {
    console.log("GRN-2026-0010 not found.");
    return;
  }

  console.log("Receipt:", receipt);

  const ledgers = await prisma.stockLedger.findMany({
    where: { inboundReceiptId: receipt.id },
    include: { product: true, palletPosition: true }
  });

  console.log(`\nFound ${ledgers.length} StockLedgers for receipt:`);
  for (const sl of ledgers) {
    console.log(`- Ledger ID: ${sl.id}`);
    console.log(`  Product Code: ${sl.product.productCode}, Size: ${sl.product.sizeLiter}`);
    console.log(`  Quantity: ${sl.quantity}, QuantityLiter: ${sl.quantityLiter}, ReservedQty: ${sl.reservedQty}`);
    console.log(`  Position: ${sl.palletPosition.positionCode}`);
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      OR: [
        { referenceId: receipt.id },
        { productId: { in: ledgers.map(l => l.productId) } }
      ]
    },
    include: { product: true },
    orderBy: { createdAt: "asc" }
  });

  console.log(`\nFound ${movements.length} StockMovements for products in receipt:`);
  for (const m of movements) {
    console.log(`- Movement ID: ${m.id}`);
    console.log(`  Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}`);
    console.log(`  Product Code: ${m.product?.productCode}`);
    console.log(`  Ref: ${m.referenceType} (${m.referenceId}), Date: ${m.createdAt}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
