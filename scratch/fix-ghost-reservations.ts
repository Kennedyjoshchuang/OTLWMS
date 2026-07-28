import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== STARTING CLEANUP OF GHOST RESERVATIONS & ORPHANED PENDING PICKING ITEMS ===");

  const targetCodes = ['6HUMAWUVA', '2BW001WVA', '6ZJMAWUVA'];

  // Step 1: Find all orphaned pending DOPickingItems on completed/delivered/shipped DOs
  const orphanedPendingItems = await prisma.dOPickingItem.findMany({
    where: {
      status: "pending",
      deliveryOrder: {
        status: { in: ["delivered", "shipped", "on_delivery"] }
      }
    },
    include: {
      deliveryOrder: true,
      product: true
    }
  });

  console.log(`Found ${orphanedPendingItems.length} orphaned pending DOPickingItem records on completed/on_delivery DOs.`);
  for (const item of orphanedPendingItems) {
    console.log(`- Deleting orphaned pending item ${item.id} | DO #${item.deliveryOrder.doNumber} (Status: ${item.deliveryOrder.status}) | Product: ${item.product.productCode} | ReqQty: ${item.requiredQty}`);
  }

  // Delete orphaned pending items in transaction
  if (orphanedPendingItems.length > 0) {
    const deleted = await prisma.dOPickingItem.deleteMany({
      where: {
        id: { in: orphanedPendingItems.map(i => i.id) }
      }
    });
    console.log(`Successfully deleted ${deleted.count} orphaned pending DOPickingItem records.`);
  }

  // Step 2: Recalculate true reservedQty for ALL StockLedger entries in the system
  console.log("\nRecalculating StockLedger.reservedQty across all stock ledgers...");
  const allLedgers = await prisma.stockLedger.findMany({
    include: {
      pickingItems: {
        where: {
          status: "pending",
          deliveryOrder: {
            status: "draft"
          }
        }
      },
      product: true
    }
  });

  let totalReleased = 0;
  let countUpdated = 0;

  for (const ledger of allLedgers) {
    const trueReservedQty = ledger.pickingItems.reduce((sum, pi) => sum + pi.requiredQty, 0);
    const oldReserved = ledger.reservedQty;
    const oldIsReserved = ledger.isReserved;
    const newIsReserved = trueReservedQty > 0;

    if (oldReserved !== trueReservedQty || oldIsReserved !== newIsReserved) {
      countUpdated++;
      const diff = oldReserved - trueReservedQty;
      if (diff > 0) totalReleased += diff;

      await prisma.stockLedger.update({
        where: { id: ledger.id },
        data: {
          reservedQty: trueReservedQty,
          isReserved: newIsReserved
        }
      });

      console.log(`- Updated Ledger ${ledger.id} (Product: ${ledger.product.productCode}): reservedQty changed from ${oldReserved} -> ${trueReservedQty}`);
    }
  }

  console.log(`\nCleanup complete! Updated ${countUpdated} stock ledgers. Total released ghost reservations: ${totalReleased} pcs.`);

  // Step 3: Print verification status for the 3 target products
  console.log("\n=== POST-CLEANUP VERIFICATION FOR TARGET PRODUCTS ===");
  const products = await prisma.product.findMany({
    where: {
      OR: targetCodes.map(c => ({ productCode: { contains: c, mode: 'insensitive' } }))
    }
  });

  for (const p of products) {
    const ledgers = await prisma.stockLedger.findMany({
      where: { productId: p.id },
      include: { palletPosition: true }
    });

    const activeQty = ledgers.reduce((sum, l) => sum + l.quantity, 0);
    const reservedQty = ledgers.reduce((sum, l) => sum + l.reservedQty, 0);

    console.log(`- Product ${p.productCode}: Active Stock = ${activeQty} pcs, Reserved Qty = ${reservedQty} pcs`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
