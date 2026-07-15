import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Searching for mismatches...");

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

  let count = 0;
  for (const dt of deliveryTickets) {
    for (const item of dt.items) {
      // Find stock matching EXACTLY the same productId
      const stockById = stockLedgers.filter((s) => s.productId === item.productId);
      const totalStockById = stockById.reduce((sum, s) => sum + s.quantity, 0);

      // Find stock matching productCode AND the DT's customerId
      const stockByCodeAndCustomer = stockLedgers.filter(
        (s) => s.product.productCode === item.productCode && s.product.customerId === dt.customerId
      );
      const totalStockByCodeAndCustomer = stockByCodeAndCustomer.reduce((sum, s) => sum + s.quantity, 0);

      if (totalStockByCodeAndCustomer > 0 && totalStockById === 0) {
        count++;
        console.log(`\n🚨 MISMATCH #${count}: DT ${dt.dtNumber} (Customer: ${dt.customer.name})`);
        console.log(`   DT Item: ${item.productCode} (Qty Required: ${item.delQtyPcs})`);
        console.log(`   Item productId in DT: ${item.productId} (${item.product?.isActive ? 'Active' : item.product ? 'Inactive' : 'No Product'})`);
        console.log(`   Available Stock for Code: ${totalStockByCodeAndCustomer} pcs across ${stockByCodeAndCustomer.length} locations`);
        for (const s of stockByCodeAndCustomer) {
          console.log(`     - Stock Ledger ID: ${s.id}, product ID in stock ledger: ${s.productId} (Active: ${s.product.isActive})`);
        }
      }
    }
  }

  console.log(`\nTotal mismatches: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
