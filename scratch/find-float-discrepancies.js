const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function hasPrecisionDrift(val) {
  if (val === null || val === undefined) return false;
  const str = val.toString();
  if (!str.includes('.')) return false;
  const decimals = str.split('.')[1];
  return decimals.length > 2;
}

async function main() {
  console.log('--- SCANNING DATABASE FOR FLOAT PRECISION DISCREPANCIES (>2 DECIMAL PLACES) ---\n');
  
  let totalDiscrepancies = 0;

  // 1. Products
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (hasPrecisionDrift(p.sizeLiter) || hasPrecisionDrift(p.weightKg)) {
      totalDiscrepancies++;
      console.log(`[Product] Code: ${p.productCode} | ID: ${p.id} | sizeLiter: ${p.sizeLiter} | weightKg: ${p.weightKg}`);
    }
  }

  // 2. PackingListItem
  const plItems = await prisma.packingListItem.findMany();
  for (const item of plItems) {
    if (hasPrecisionDrift(item.expectedLiter) || hasPrecisionDrift(item.actualLiter)) {
      totalDiscrepancies++;
      console.log(`[PackingListItem] ID: ${item.id} | PL ID: ${item.packingListId} | expectedLiter: ${item.expectedLiter} | actualLiter: ${item.actualLiter}`);
    }
  }

  // 3. InboundReceipt
  const receipts = await prisma.inboundReceipt.findMany();
  for (const r of receipts) {
    if (hasPrecisionDrift(r.totalLiterReceived)) {
      totalDiscrepancies++;
      console.log(`[InboundReceipt] GRN: ${r.receiptNumber} | totalLiterReceived: ${r.totalLiterReceived}`);
    }
  }

  // 4. StockLedger
  const ledgers = await prisma.stockLedger.findMany({
    include: { product: true }
  });
  for (const sl of ledgers) {
    if (hasPrecisionDrift(sl.quantityLiter)) {
      totalDiscrepancies++;
      console.log(`[StockLedger] ID: ${sl.id} | Product: ${sl.product?.productCode} | quantity: ${sl.quantity} | quantityLiter: ${sl.quantityLiter}`);
    }
  }

  // 5. DeliveryTicket
  const tickets = await prisma.deliveryTicket.findMany();
  for (const dt of tickets) {
    if (hasPrecisionDrift(dt.totalGrossKg) || hasPrecisionDrift(dt.totalNetKg) || hasPrecisionDrift(dt.totalLiter)) {
      totalDiscrepancies++;
      console.log(`[DeliveryTicket] DT: ${dt.dtNumber} | totalLiter: ${dt.totalLiter} | totalGrossKg: ${dt.totalGrossKg} | totalNetKg: ${dt.totalNetKg}`);
    }
  }

  // 6. DeliveryTicketItem
  const dtItems = await prisma.deliveryTicketItem.findMany();
  for (const item of dtItems) {
    if (hasPrecisionDrift(item.delQtyLiter) || hasPrecisionDrift(item.delQtyKg)) {
      totalDiscrepancies++;
      console.log(`[DeliveryTicketItem] ID: ${item.id} | DT ID: ${item.deliveryTicketId} | Code: ${item.productCode} | delQtyLiter: ${item.delQtyLiter} | delQtyKg: ${item.delQtyKg}`);
    }
  }

  // 7. Invoice
  const invoices = await prisma.invoice.findMany();
  for (const inv of invoices) {
    if (hasPrecisionDrift(inv.totalAmount)) {
      totalDiscrepancies++;
      console.log(`[Invoice] Number: ${inv.invoiceNumber} | totalAmount: ${inv.totalAmount}`);
    }
  }

  // 8. InvoiceItem
  const invItems = await prisma.invoiceItem.findMany();
  for (const item of invItems) {
    if (hasPrecisionDrift(item.quantity) || hasPrecisionDrift(item.unitPrice) || hasPrecisionDrift(item.totalPrice)) {
      totalDiscrepancies++;
      console.log(`[InvoiceItem] Activity: ${item.activityName} | qty: ${item.quantity} | unitPrice: ${item.unitPrice} | totalPrice: ${item.totalPrice}`);
    }
  }

  console.log(`\nScan complete. Total float discrepancy records found: ${totalDiscrepancies}`);
}

main()
  .catch((e) => {
    console.error('Diagnostic error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
