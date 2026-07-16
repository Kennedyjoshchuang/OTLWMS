import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const productCode = "6ZJMAWUVA";
  const product = await prisma.product.findFirst({
    where: { productCode }
  });

  if (!product) {
    console.log(`Product ${productCode} not found.`);
    return;
  }

  console.log(`=== Product: ${product.productCode} (ID: ${product.id}) ===`);

  // 1. Inbound Receipts containing this product
  // Let's see: since InboundReceipt doesn't have item rows, how do we find them?
  // We can find StockLedgers referencing this product, and get their inboundReceiptIds.
  const ledgers = await prisma.stockLedger.findMany({
    where: { productId: product.id },
    include: { inboundReceipt: true, palletPosition: true }
  });

  console.log(`\n--- StockLedger Entries (${ledgers.length}) ---`);
  for (const sl of ledgers) {
    console.log(`- SL ID: ${sl.id}`);
    console.log(`  Qty: ${sl.quantity}, Reserved: ${sl.reservedQty}, InboundDate: ${sl.inboundDate}`);
    console.log(`  Position: ${sl.palletPosition.positionCode}`);
    console.log(`  Receipt: ${sl.inboundReceipt?.receiptNumber} (ID: ${sl.inboundReceiptId})`);
  }

  // 2. Stock Movements
  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "asc" }
  });

  console.log(`\n--- Stock Movements (${movements.length}) ---`);
  for (const m of movements) {
    console.log(`- ID: ${m.id}, Type: ${m.movementType}, Qty: ${m.quantity}, Before: ${m.quantityBefore}, After: ${m.quantityAfter}, Ref: ${m.referenceType} (${m.referenceId}), Date: ${m.createdAt}`);
  }

  // 3. Picking Items
  const pickingItems = await prisma.dOPickingItem.findMany({
    where: { productId: product.id },
    include: { deliveryOrder: true }
  });

  console.log(`\n--- Picking Items (${pickingItems.length}) ---`);
  for (const pi of pickingItems) {
    console.log(`- ID: ${pi.id}, ReqQty: ${pi.requiredQty}, PickedQty: ${pi.pickedQty}, Status: ${pi.status}, DO: ${pi.deliveryOrder.doNumber} (Status: ${pi.deliveryOrder.status})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
