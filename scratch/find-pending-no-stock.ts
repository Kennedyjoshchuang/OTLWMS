import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Checking all delivery tickets for items with no stock...");

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

  for (const ticket of deliveryTickets) {
    console.log(`\nDT: ${ticket.dtNumber} (Customer: ${ticket.customer.name}, Status: ${ticket.status})`);
    for (const item of ticket.items) {
      const whereClause: any = item.productId
        ? { productId: item.productId, quantity: { gt: 0 } }
        : { product: { productCode: item.productCode }, quantity: { gt: 0 } };

      const stockEntries = await prisma.stockLedger.findMany({
        where: whereClause,
      });

      const totalQty = stockEntries.reduce((sum, s) => sum + s.quantity, 0);
      const totalReserved = stockEntries.reduce((sum, s) => sum + s.reservedQty, 0);
      const totalAvailable = totalQty - totalReserved;

      if (totalAvailable <= 0) {
        console.log(`  - Item Code: ${item.productCode} (${item.productName || 'No Name'})`);
        console.log(`    Qty Required: ${item.delQtyPcs}`);
        console.log(`    Product ID: ${item.productId} (${item.product?.isActive ? 'Active' : item.product ? 'Inactive' : 'No Product'})`);
        console.log(`    Available Qty: ${totalAvailable} (Total Qty: ${totalQty}, Reserved Qty: ${totalReserved})`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
