import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing reservations...");

  const productsToCheck = ["2GXMCNUVA", "2GD001UVA"];

  for (const code of productsToCheck) {
    console.log(`\nProduct Code: ${code}`);

    const products = await prisma.product.findMany({
      where: { productCode: code },
    });

    for (const p of products) {
      console.log(`- Product ID: ${p.id} (Active: ${p.isActive})`);

      const stockLedgers = await prisma.stockLedger.findMany({
        where: { productId: p.id },
        include: {
          palletPosition: true,
          pickingItems: {
            include: {
              deliveryOrder: true,
            },
          },
        },
      });

      console.log(`  Stock ledgers: ${stockLedgers.length}`);
      for (const sl of stockLedgers) {
        console.log(`    * SL ID: ${sl.id}, Quantity: ${sl.quantity}, Reserved: ${sl.reservedQty}, Location: ${sl.palletPosition.positionCode}`);
        console.log(`      Picking Items: ${sl.pickingItems.length}`);
        for (const pi of sl.pickingItems) {
          console.log(`        - PI ID: ${pi.id}, Required Qty: ${pi.requiredQty}, Status: ${pi.status}, DO: ${pi.deliveryOrder.doNumber} (Status: ${pi.deliveryOrder.status})`);
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
