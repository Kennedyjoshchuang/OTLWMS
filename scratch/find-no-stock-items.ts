import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing delivery tickets (pick lists) with items...");

  // Find all delivery tickets
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

  console.log(`Found ${deliveryTickets.length} delivery tickets in database.`);

  for (const ticket of deliveryTickets) {
    let hasIssues = false;
    const issueLogs: string[] = [];

    for (const item of ticket.items) {
      // Find stock using the exact same logic as DeliveryTicketDetailPage
      const whereClause: any = item.productId
        ? { productId: item.productId, quantity: { gt: 0 } }
        : { product: { productCode: item.productCode }, quantity: { gt: 0 } };

      const stockEntries = await prisma.stockLedger.findMany({
        where: whereClause,
        include: {
          palletPosition: true,
        },
      });

      const totalAvailable = stockEntries.reduce((sum, s) => sum + s.quantity - s.reservedQty, 0);

      // Now search for ANY stock matching the productCode, regardless of product record / active state
      const stockByCode = await prisma.stockLedger.findMany({
        where: {
          product: { productCode: item.productCode },
          quantity: { gt: 0 },
        },
        include: {
          product: true,
          palletPosition: true,
        },
      });

      const totalByCode = stockByCode.reduce((sum, s) => sum + s.quantity - s.reservedQty, 0);

      if (totalAvailable <= 0 && totalByCode > 0) {
        hasIssues = true;
        issueLogs.push(`  - Item: ${item.productCode} (${item.productName || 'No Name'})`);
        issueLogs.push(`    Required: ${item.delQtyPcs}`);
        issueLogs.push(`    Stock available via exact match: ${totalAvailable} pcs (StockLedger records: ${stockEntries.length})`);
        issueLogs.push(`    Stock available via code match (any product record): ${totalByCode} pcs (StockLedger records: ${stockByCode.length})`);
        for (const s of stockByCode) {
          issueLogs.push(`      Warehouse has stock under Product Code: ${s.product.productCode} (Product ID: ${s.productId}, Product Active: ${s.product.isActive}, Customer ID: ${s.product.customerId}) at position ${s.palletPosition.positionCode} (Qty: ${s.quantity})`);
        }
      }
    }

    if (hasIssues) {
      console.log(`\nDelivery Ticket ID: ${ticket.id}`);
      console.log(`DT Number: ${ticket.dtNumber} (Customer: ${ticket.customer.name}, Status: ${ticket.status})`);
      for (const log of issueLogs) {
        console.log(log);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
