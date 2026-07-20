const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== FINDING THE EXACT 0.60 LITER DIFFERENCE ON JULY 18 ===\n');

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

  console.log(`Analyzing ${july18Receipts.length} GRNs on July 18:\n`);

  let sumDBTotalLiter = 0;
  let sumPcsTimesSize = 0;

  for (const r of july18Receipts) {
    sumDBTotalLiter += r.totalLiterReceived;

    for (const sl of r.stockLedgers) {
      const p = sl.product;
      
      // Try parsing sizeLiter from productName if p.sizeLiter is missing
      let parsedSize = p?.sizeLiter;
      if (!parsedSize && p?.productName) {
        const m = p.productName.match(/(\d+(?:\.\d+)?)\s*L(?:iter)?\b/i);
        if (m) parsedSize = parseFloat(m[1]);
      }

      const calc = sl.quantity * (parsedSize || 0);
      sumPcsTimesSize += calc;

      console.log(`GRN: ${r.receiptNumber} | Pcs: ${sl.quantity} | ProdCode: ${p?.productCode} | ProdName: "${p?.productName}" | sizeInDB: ${p?.sizeLiter} | parsedSize: ${parsedSize} | sl.quantityLiter: ${sl.quantityLiter} | DB totalLiterReceived: ${r.totalLiterReceived}`);
    }
  }

  console.log('\n------------------------------------------------');
  console.log(`Sum of DB totalLiterReceived: ${sumDBTotalLiter}`);
  console.log(`Sum of (Qty * parsedSizeLiter): ${sumPcsTimesSize}`);
  console.log(`Difference (DB - Parsed): ${sumDBTotalLiter - sumPcsTimesSize}`);
  console.log('------------------------------------------------');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
