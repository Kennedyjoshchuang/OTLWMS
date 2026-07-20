const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== CHECKING PHYSICAL VS DB TOTALS FOR JULY 18 ===\n');

  const receipts = await prisma.inboundReceipt.findMany({
    include: {
      stockLedgers: {
        include: { product: true }
      }
    }
  });

  const july18Receipts = receipts.filter(r => {
    const d = new Date(r.receivedDate || r.createdAt);
    const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
    return dayKey === '2026-07-18';
  });

  console.log(`Analyzing all ${july18Receipts.length} GRNs for July 18...`);

  // Let's sum totalLiterReceived for all 46 GRNs
  let sumDBTotalLiterReceived = 0;
  for (const r of july18Receipts) {
    sumDBTotalLiterReceived += r.totalLiterReceived;
  }
  console.log(`DB sum of totalLiterReceived: ${sumDBTotalLiterReceived}`);
  console.log(`Target physical count: 4608.48`);
  console.log(`Difference: ${sumDBTotalLiterReceived - 4608.48}`);

  // Let's print all GRN totalLiterReceived values to see if any GRN has unrounded float or slight discrepancy
  for (const r of july18Receipts) {
    console.log(`GRN: ${r.receiptNumber} | Pcs: ${r.totalPcsReceived} | totalLiterReceived: ${r.totalLiterReceived}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
