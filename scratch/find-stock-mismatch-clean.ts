import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing stock database for mismatches...");

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      product: {
        include: { customer: true },
      },
      palletPosition: {
        include: { rack: true },
      },
    },
  });

  const dtItems = await prisma.deliveryTicketItem.findMany({
    include: {
      deliveryTicket: {
        include: { customer: true },
      },
      product: true,
    },
  });

  let mismatchesFound = 0;

  for (const item of dtItems) {
    const matchingSLByCode = stockLedgers.filter(sl => sl.product.productCode === item.productCode);
    const matchingSLById = stockLedgers.filter(sl => sl.productId === item.productId);

    if (matchingSLByCode.length > 0 && matchingSLById.length === 0) {
      mismatchesFound++;
      console.log(`\n❌ MISMATCH #${mismatchesFound}:`);
      console.log(`  DT Item ID: ${item.id}`);
      console.log(`  DT Number: ${item.deliveryTicket.dtNumber}`);
      console.log(`  DT Customer: ${item.deliveryTicket.customer.name} (ID: ${item.deliveryTicket.customerId})`);
      console.log(`  Product Code in DT: ${item.productCode}`);
      console.log(`  Product ID in DT: ${item.productId}`);
      if (item.product) {
        console.log(`  Matched Product Customer ID: ${item.product.customerId}`);
      } else {
        console.log(`  Matched Product: NONE`);
      }
      console.log(`  Stock ledger locations for this product code (${item.productCode}):`);
      for (const sl of matchingSLByCode) {
        console.log(`    - Stock Ledger ID: ${sl.id}`);
        console.log(`      Product ID in Stock: ${sl.productId}`);
        console.log(`      Product Name in Stock: ${sl.product.productName}`);
        console.log(`      Customer in Stock: ${sl.product.customer.name} (ID: ${sl.product.customerId})`);
        console.log(`      Location: ${sl.palletPosition.positionCode}`);
        console.log(`      Quantity: ${sl.quantity}`);
      }
    }
  }

  console.log(`\nTotal mismatches found: ${mismatchesFound}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
