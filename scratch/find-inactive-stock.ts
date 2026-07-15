import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking for inactive entities with positive stock...");

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      product: true,
      palletPosition: {
        include: { rack: true },
      },
    },
  });

  let inactiveRacks = 0;
  let inactivePositions = 0;
  let inactiveProducts = 0;

  for (const sl of stockLedgers) {
    if (!sl.product.isActive) {
      inactiveProducts++;
      console.log(`⚠️ Product inactive: ${sl.product.productCode} has quantity ${sl.quantity} at ${sl.palletPosition.positionCode}`);
    }
    if (!sl.palletPosition.isActive) {
      inactivePositions++;
      console.log(`⚠️ Position inactive: ${sl.palletPosition.positionCode} has quantity ${sl.quantity} of ${sl.product.productCode}`);
    }
    if (!sl.palletPosition.rack.isActive) {
      inactiveRacks++;
      console.log(`⚠️ Rack inactive: ${sl.palletPosition.rack.rackCode} has quantity ${sl.quantity} of ${sl.product.productCode} at position ${sl.palletPosition.positionCode}`);
    }
  }

  console.log(`\nResults:`);
  console.log(`- Stock in inactive Products: ${inactiveProducts}`);
  console.log(`- Stock in inactive Positions: ${inactivePositions}`);
  console.log(`- Stock in inactive Racks: ${inactiveRacks}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
