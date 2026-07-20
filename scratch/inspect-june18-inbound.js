const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== LISTING ALL INBOUND RECEIPTS DATES AND TOTALS ===\n');

  const receipts = await prisma.inboundReceipt.findMany({
    orderBy: { receivedDate: 'desc' },
    include: {
      stockLedgers: {
        include: { product: true }
      }
    }
  });

  for (const r of receipts) {
    const d = new Date(r.receivedDate || r.createdAt);
    const dateStr = d.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' });
    console.log(`GRN: ${r.receiptNumber} | ReceivedDate (WITA): ${dateStr} (raw: ${d.toISOString()}) | DB totalLiterReceived: ${r.totalLiterReceived} | Pcs: ${r.totalPcsReceived}`);
    for (const sl of r.stockLedgers) {
      const p = sl.product;
      const calc = sl.quantity * (p?.sizeLiter || 0);
      console.log(`   -> Product: ${p?.productCode} (${p?.productName}) | sizeLiter: ${p?.sizeLiter} | Qty: ${sl.quantity} | sl.quantityLiter: ${sl.quantityLiter} | calc: ${calc}`);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
