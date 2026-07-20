const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== DETAILED INSPECTION OF ALL GRNS ON JULY 18 ===\n');

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

  console.log(`Found ${july18Receipts.length} GRNs on July 18:\n`);

  let grandTotalLiterReceivedDB = 0;
  let grandTotalCalcFromLedgerQtyLiter = 0;
  let grandTotalCalcFromProductSizeLiter = 0;

  for (const r of july18Receipts) {
    grandTotalLiterReceivedDB += r.totalLiterReceived;

    console.log(`GRN: ${r.receiptNumber} | totalLiterReceived: ${r.totalLiterReceived} | totalPcs: ${r.totalPcsReceived}`);

    for (const sl of r.stockLedgers) {
      const p = sl.product;
      const sizeFromProd = p?.sizeLiter || 0;
      const calcFromProd = sl.quantity * sizeFromProd;

      grandTotalCalcFromLedgerQtyLiter += sl.quantityLiter;
      grandTotalCalcFromProductSizeLiter += calcFromProd;

      console.log(`   -> Ledger ${sl.id} | Product ${p?.productCode} (${p?.productName})`);
      console.log(`      Qty: ${sl.quantity} | Prod sizeLiter: ${sizeFromProd}`);
      console.log(`      sl.quantityLiter (in DB): ${sl.quantityLiter}`);
      console.log(`      Qty * Product.sizeLiter: ${calcFromProd}`);

      // Check if sl.quantityLiter matches Qty * sizeFromProd
      if (sl.quantityLiter !== calcFromProd) {
        console.log(`      ⚠️ DISCREPANCY IN LEDGER! sl.quantityLiter (${sl.quantityLiter}) != Qty * Prod.sizeLiter (${calcFromProd})`);
      }
    }
  }

  console.log('\n==================================================');
  console.log(`Grand Total DB totalLiterReceived: ${grandTotalLiterReceivedDB}`);
  console.log(`Grand Total StockLedger.quantityLiter: ${grandTotalCalcFromLedgerQtyLiter}`);
  console.log(`Grand Total Qty * Product.sizeLiter: ${grandTotalCalcFromProductSizeLiter}`);
  console.log('==================================================');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
