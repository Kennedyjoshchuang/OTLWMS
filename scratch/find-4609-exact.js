const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== SEARCHING ALL RECORDS WITH TOTALS NEAR 4608 / 4609 OR ITEMS THAT SUM TO ~4608 ===\n');

  // Check all InboundReceipts
  const receipts = await prisma.inboundReceipt.findMany({
    include: {
      stockLedgers: {
        include: { product: true }
      }
    }
  });

  console.log(`Checking ${receipts.length} Inbound Receipts...`);
  for (const r of receipts) {
    const sumCalc = r.stockLedgers.reduce((s, sl) => s + sl.quantity * (sl.product?.sizeLiter || 0), 0);
    const sumLedger = r.stockLedgers.reduce((s, sl) => s + sl.quantityLiter, 0);
    const d = new Date(r.receivedDate || r.createdAt);
    if (r.totalLiterReceived > 4000 || sumCalc > 4000 || sumLedger > 4000) {
      console.log(`[InboundReceipt] GRN: ${r.receiptNumber} | ReceivedDate: ${d.toISOString()} | totalLiterReceived: ${r.totalLiterReceived} | sumLedger: ${sumLedger} | sumCalc: ${sumCalc}`);
    }
  }

  // Check all DeliveryTickets
  const tickets = await prisma.deliveryTicket.findMany({
    include: { items: { include: { product: true } } }
  });
  console.log(`\nChecking ${tickets.length} Delivery Tickets...`);
  for (const dt of tickets) {
    const sumCalc = dt.items.reduce((s, i) => s + i.delQtyPcs * (i.product?.sizeLiter || 0), 0);
    const sumLiter = dt.items.reduce((s, i) => s + (i.delQtyLiter || 0), 0);
    const d = new Date(dt.deliveryDate || dt.createdAt);
    if (dt.totalLiter > 3000 || dt.totalGrossKg > 3000 || sumCalc > 3000 || sumLiter > 3000) {
      console.log(`[DeliveryTicket] DT: ${dt.dtNumber} | Date: ${d.toISOString()} | totalLiter: ${dt.totalLiter} | grossKg: ${dt.totalGrossKg} | sumLiter: ${sumLiter} | sumCalc: ${sumCalc}`);
      for (const item of dt.items) {
        console.log(`   -> Product: ${item.productCode} (${item.productName}) | Pcs: ${item.delQtyPcs} | sizeLiter: ${item.product?.sizeLiter} | delQtyLiter: ${item.delQtyLiter} | Pcs*sizeLiter: ${item.delQtyPcs * (item.product?.sizeLiter || 0)}`);
      }
    }
  }

  // Group InboundReceipts by Received Date (day)
  console.log('\n=== GROUPING INBOUND RECEIPTS BY DAY (WITA) ===');
  const dayInboundMap = new Map();
  for (const r of receipts) {
    const d = new Date(r.receivedDate || r.createdAt);
    const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); // YYYY-MM-DD
    const total = r.totalLiterReceived || 0;
    const calcTotal = r.stockLedgers.reduce((s, sl) => s + sl.quantity * (sl.product?.sizeLiter || 0), 0);
    if (!dayInboundMap.has(dayKey)) {
      dayInboundMap.set(dayKey, { dayKey, totalReceipts: 0, totalLiter: 0, calcLiter: 0, receipts: [] });
    }
    const entry = dayInboundMap.get(dayKey);
    entry.totalReceipts += 1;
    entry.totalLiter += total;
    entry.calcLiter += calcTotal;
    entry.receipts.push(r);
  }

  for (const [day, data] of dayInboundMap.entries()) {
    console.log(`Date: ${day} | GRNs: ${data.totalReceipts} | totalLiterReceived Sum: ${data.totalLiter} | calcLiter Sum: ${data.calcLiter}`);
  }

  // Group DeliveryTickets by Delivery/Created Date (day)
  console.log('\n=== GROUPING DELIVERY TICKETS BY DAY (WITA) ===');
  const dayDTMap = new Map();
  for (const dt of tickets) {
    const d = new Date(dt.deliveryDate || dt.createdAt);
    const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' }); // YYYY-MM-DD
    const totalLiter = dt.totalLiter || dt.items.reduce((s, i) => s + (i.delQtyLiter || 0), 0);
    const totalGross = dt.totalGrossKg || (totalLiter * 1.3);
    const calcLiter = dt.items.reduce((s, i) => s + i.delQtyPcs * (i.product?.sizeLiter || 0), 0);
    const calcGross = calcLiter * 1.3;
    if (!dayDTMap.has(dayKey)) {
      dayDTMap.set(dayKey, { dayKey, totalDTs: 0, totalLiter: 0, totalGross: 0, calcLiter: 0, calcGross: 0 });
    }
    const entry = dayDTMap.get(dayKey);
    entry.totalDTs += 1;
    entry.totalLiter += totalLiter;
    entry.totalGross += totalGross;
    entry.calcLiter += calcLiter;
    entry.calcGross += calcGross;
  }

  for (const [day, data] of dayDTMap.entries()) {
    console.log(`Date: ${day} | DTs: ${data.totalDTs} | Total Liter: ${data.totalLiter} | Gross Kg (Liter * 1.3): ${data.totalGross} | calcLiter: ${data.calcLiter} | calcGross: ${data.calcGross}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
