import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing cross-customer products...");

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: {
      product: {
        include: { customer: true },
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

  let count = 0;
  for (const item of dtItems) {
    const matchingStockByCodeAnyCustomer = stockLedgers.filter(
      (s) => s.product.productCode === item.productCode
    );

    if (matchingStockByCodeAnyCustomer.length > 0) {
      // Find how many belong to the DT's customer vs other customers
      const sameCustomerStock = matchingStockByCodeAnyCustomer.filter(
        (s) => s.product.customerId === item.deliveryTicket.customerId
      );
      const otherCustomerStock = matchingStockByCodeAnyCustomer.filter(
        (s) => s.product.customerId !== item.deliveryTicket.customerId
      );

      if (otherCustomerStock.length > 0) {
        count++;
        console.log(`\nCase #${count}: DT ${item.deliveryTicket.dtNumber} (Customer: ${item.deliveryTicket.customer.name})`);
        console.log(`   DT Item: ${item.productCode}`);
        console.log(`   Stock for this customer: ${sameCustomerStock.reduce((sum, s) => sum + s.quantity, 0)} pcs`);
        console.log(`   Stock for OTHER customers:`);
        for (const s of otherCustomerStock) {
          console.log(`     - Stock Ledger ID: ${s.id}, Qty: ${s.quantity}, Customer: ${s.product.customer.name} (Code: ${s.product.customer.code})`);
        }
      }
    }
  }

  console.log(`\nTotal cross-customer matches: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
