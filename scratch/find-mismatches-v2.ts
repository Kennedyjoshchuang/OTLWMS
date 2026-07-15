import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing DeliveryTicketItems and StockLedgers for discrepancies...");

  // Fetch all delivery tickets (with items)
  const deliveryTickets = await prisma.deliveryTicket.findMany({
    include: {
      customer: true,
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  // Fetch all stock ledgers with quantity > 0
  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      product: true,
    },
  });

  for (const dt of deliveryTickets) {
    console.log(`\nDT: ${dt.dtNumber} (Customer: ${dt.customer.name})`);
    for (const item of dt.items) {
      console.log(`  - Item: ${item.productCode} (Qty Required: ${item.delQtyPcs})`);
      console.log(`    Item productId: ${item.productId} (${item.product?.isActive ? 'Active' : item.product ? 'Inactive' : 'No Product'})`);

      // Find stock matching EXACTLY the same productId
      const stockById = stockLedgers.filter((s) => s.productId === item.productId);
      const totalStockById = stockById.reduce((sum, s) => sum + s.quantity, 0);

      // Find stock matching productCode (regardless of productId or customer)
      const stockByCode = stockLedgers.filter((s) => s.product.productCode === item.productCode);
      const totalStockByCode = stockByCode.reduce((sum, s) => sum + s.quantity, 0);

      // Find stock matching productCode AND the DT's customerId
      const stockByCodeAndCustomer = stockLedgers.filter(
        (s) => s.product.productCode === item.productCode && s.product.customerId === dt.customerId
      );
      const totalStockByCodeAndCustomer = stockByCodeAndCustomer.reduce((sum, s) => sum + s.quantity, 0);

      console.log(`    Stock by exact productId: ${totalStockById} pcs across ${stockById.length} locations`);
      console.log(`    Stock by productCode: ${totalStockByCode} pcs across ${stockByCode.length} locations`);
      console.log(`    Stock by productCode & DT Customer: ${totalStockByCodeAndCustomer} pcs across ${stockByCodeAndCustomer.length} locations`);

      if (totalStockByCodeAndCustomer > 0 && totalStockById === 0) {
        console.log(`    🚨 mismatch! There is stock for code ${item.productCode} for this customer, but NOT for this item's productId (${item.productId})!`);
        for (const s of stockByCodeAndCustomer) {
          console.log(`      Stock ledger ID: ${s.id}, product ID in stock ledger: ${s.productId} (${s.product.isActive ? 'Active' : 'Inactive'})`);
        }
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
