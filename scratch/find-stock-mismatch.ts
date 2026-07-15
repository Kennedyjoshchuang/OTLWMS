import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing stock database...");

  // 1. Fetch all stock ledger entries with quantity > 0
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

  console.log(`\nFound ${stockLedgers.length} non-empty StockLedger entries:`);
  for (const sl of stockLedgers) {
    console.log(`- SL ID: ${sl.id}`);
    console.log(`  Product Code: ${sl.product.productCode} (ID: ${sl.productId})`);
    console.log(`  Product Name: ${sl.product.productName}`);
    console.log(`  Customer: ${sl.product.customer.name} (Code: ${sl.product.customer.code}, ID: ${sl.product.customerId})`);
    console.log(`  Location: ${sl.palletPosition.positionCode} (Rack: ${sl.palletPosition.rack.rackCode})`);
    console.log(`  Quantity: ${sl.quantity}, Reserved: ${sl.reservedQty}`);
  }

  // 2. Fetch all delivery tickets and their items
  const dtItems = await prisma.deliveryTicketItem.findMany({
    include: {
      deliveryTicket: {
        include: { customer: true },
      },
      product: true,
    },
  });

  console.log(`\nFound ${dtItems.length} DeliveryTicketItem entries:`);
  for (const item of dtItems) {
    console.log(`- DT Item ID: ${item.id}`);
    console.log(`  DT Number: ${item.deliveryTicket.dtNumber}`);
    console.log(`  DT Customer: ${item.deliveryTicket.customer.name} (ID: ${item.deliveryTicket.customerId})`);
    console.log(`  Product Code in DT: ${item.productCode}`);
    console.log(`  Product ID in DT: ${item.productId}`);
    if (item.product) {
      console.log(`  Matched Product Customer ID: ${item.product.customerId}`);
    } else {
      console.log(`  Matched Product: NONE`);
    }

    // See if there's any stock ledger entry for this product code
    const matchingSLByCode = stockLedgers.filter(sl => sl.product.productCode === item.productCode);
    const matchingSLById = stockLedgers.filter(sl => sl.productId === item.productId);

    console.log(`  Matching SL by Code: ${matchingSLByCode.length}, by ID: ${matchingSLById.length}`);
    if (matchingSLByCode.length > 0 && matchingSLById.length === 0) {
      console.log(`  ⚠️ MISMATCH WARNING: Stock exists for code ${item.productCode} but NOT for product ID ${item.productId}!`);
      for (const m of matchingSLByCode) {
        console.log(`    - Stock product ID: ${m.productId}, Stock Customer ID: ${m.product.customerId}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
