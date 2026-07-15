import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Auditing reservedQty vs actual pending picking items...");

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

  let totalDanglingReservations = 0;
  let mismatchCount = 0;

  for (const sl of stockLedgers) {
    // Sum of requiredQty for pending picking items
    const pendingPickingQty = sl.pickingItems
      .filter((pi) => pi.status === "pending")
      .reduce((sum, pi) => sum + pi.requiredQty, 0);

    if (sl.reservedQty !== pendingPickingQty) {
      mismatchCount++;
      console.log(`\n🚨 MISMATCH #${mismatchCount} on StockLedger ID: ${sl.id}`);
      console.log(`   Product: ${sl.product.productCode} (${sl.product.productName})`);
      console.log(`   Location: ${sl.palletPosition.positionCode}`);
      console.log(`   Physical Qty in stock: ${sl.quantity}`);
      console.log(`   reservedQty in DB: ${sl.reservedQty}`);
      console.log(`   Sum of pending picking items: ${pendingPickingQty}`);

      if (sl.pickingItems.length > 0) {
        console.log(`   Picking items:`);
        for (const pi of sl.pickingItems) {
          console.log(`     - PI ID: ${pi.id}, Required Qty: ${pi.requiredQty}, Status: ${pi.status}, DO: ${pi.deliveryOrder.doNumber} (DO Status: ${pi.deliveryOrder.status})`);
        }
      } else {
        console.log(`   No picking items exist.`);
      }

      totalDanglingReservations += Math.max(0, sl.reservedQty - pendingPickingQty);
    }
  }

  console.log(`\nAudit Summary:`);
  console.log(`- Mismatched stock entries: ${mismatchCount}`);
  console.log(`- Total dangling reserved quantity: ${totalDanglingReservations}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
