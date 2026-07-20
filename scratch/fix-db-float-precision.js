const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function roundFloat(val, decimals = 2) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

function hasPrecisionDrift(val) {
  if (val === null || val === undefined) return false;
  const str = val.toString();
  if (!str.includes('.')) return false;
  const decimals = str.split('.')[1];
  return decimals.length > 2;
}

async function main() {
  console.log('--- STARTING DATABASE FLOAT PRECISION CLEANUP (ROUND TO 2 DECIMALS) ---\n');
  let updatedCount = 0;

  // 1. Products
  const products = await prisma.product.findMany();
  for (const p of products) {
    if (hasPrecisionDrift(p.sizeLiter) || hasPrecisionDrift(p.weightKg)) {
      const newSize = p.sizeLiter !== null ? roundFloat(p.sizeLiter, 2) : null;
      const newWeight = p.weightKg !== null ? roundFloat(p.weightKg, 2) : null;
      await prisma.product.update({
        where: { id: p.id },
        data: { sizeLiter: newSize, weightKg: newWeight },
      });
      console.log(`[Updated Product] Code: ${p.productCode} | sizeLiter: ${p.sizeLiter} -> ${newSize} | weightKg: ${p.weightKg} -> ${newWeight}`);
      updatedCount++;
    }
  }

  // 2. PackingListItem
  const plItems = await prisma.packingListItem.findMany();
  for (const item of plItems) {
    if (hasPrecisionDrift(item.expectedLiter) || hasPrecisionDrift(item.actualLiter)) {
      const newExp = item.expectedLiter !== null ? roundFloat(item.expectedLiter, 2) : null;
      const newAct = roundFloat(item.actualLiter, 2);
      await prisma.packingListItem.update({
        where: { id: item.id },
        data: { expectedLiter: newExp, actualLiter: newAct },
      });
      console.log(`[Updated PackingListItem] ID: ${item.id} | exp: ${item.expectedLiter} -> ${newExp} | act: ${item.actualLiter} -> ${newAct}`);
      updatedCount++;
    }
  }

  // 3. InboundReceipt
  const receipts = await prisma.inboundReceipt.findMany();
  for (const r of receipts) {
    if (hasPrecisionDrift(r.totalLiterReceived)) {
      const newTotal = roundFloat(r.totalLiterReceived, 2);
      await prisma.inboundReceipt.update({
        where: { id: r.id },
        data: { totalLiterReceived: newTotal },
      });
      console.log(`[Updated InboundReceipt] GRN: ${r.receiptNumber} | totalLiterReceived: ${r.totalLiterReceived} -> ${newTotal}`);
      updatedCount++;
    }
  }

  // 4. StockLedger
  const ledgers = await prisma.stockLedger.findMany({ include: { product: true } });
  for (const sl of ledgers) {
    if (hasPrecisionDrift(sl.quantityLiter)) {
      const newQtyLiter = roundFloat(sl.quantityLiter, 2);
      await prisma.stockLedger.update({
        where: { id: sl.id },
        data: { quantityLiter: newQtyLiter },
      });
      console.log(`[Updated StockLedger] ID: ${sl.id} | Product: ${sl.product?.productCode} | quantityLiter: ${sl.quantityLiter} -> ${newQtyLiter}`);
      updatedCount++;
    }
  }

  // 5. DeliveryTicketItem
  const dtItems = await prisma.deliveryTicketItem.findMany();
  for (const item of dtItems) {
    if (hasPrecisionDrift(item.delQtyLiter) || hasPrecisionDrift(item.delQtyKg)) {
      const newLiter = item.delQtyLiter !== null ? roundFloat(item.delQtyLiter, 2) : null;
      const newKg = item.delQtyKg !== null ? roundFloat(item.delQtyKg, 2) : null;
      await prisma.deliveryTicketItem.update({
        where: { id: item.id },
        data: { delQtyLiter: newLiter, delQtyKg: newKg },
      });
      console.log(`[Updated DeliveryTicketItem] ID: ${item.id} | Code: ${item.productCode} | delQtyLiter: ${item.delQtyLiter} -> ${newLiter}`);
      updatedCount++;
    }
  }

  // 6. Sync DeliveryTicket Header Totals
  const tickets = await prisma.deliveryTicket.findMany({ include: { items: true } });
  for (const dt of tickets) {
    const calcTotalLiter = roundFloat(dt.items.reduce((sum, i) => sum + (i.delQtyLiter ?? 0), 0), 2);
    const calcTotalGrossKg = roundFloat(calcTotalLiter * 1.3, 2);
    if (hasPrecisionDrift(dt.totalLiter) || hasPrecisionDrift(dt.totalGrossKg) || dt.totalLiter !== calcTotalLiter || dt.totalGrossKg !== calcTotalGrossKg) {
      await prisma.deliveryTicket.update({
        where: { id: dt.id },
        data: { totalLiter: calcTotalLiter, totalGrossKg: calcTotalGrossKg },
      });
      console.log(`[Synced DeliveryTicket] DT: ${dt.dtNumber} | totalLiter: ${dt.totalLiter} -> ${calcTotalLiter} | grossKg: ${dt.totalGrossKg} -> ${calcTotalGrossKg}`);
      updatedCount++;
    }
  }

  // 7. InvoiceItem
  const invItems = await prisma.invoiceItem.findMany();
  for (const item of invItems) {
    if (hasPrecisionDrift(item.quantity) || hasPrecisionDrift(item.unitPrice) || hasPrecisionDrift(item.totalPrice)) {
      const newQty = roundFloat(item.quantity, 2);
      const newUnitPrice = roundFloat(item.unitPrice, 2);
      const newPrice = roundFloat(item.totalPrice, 2);
      await prisma.invoiceItem.update({
        where: { id: item.id },
        data: { quantity: newQty, unitPrice: newUnitPrice, totalPrice: newPrice },
      });
      console.log(`[Updated InvoiceItem] Activity: ${item.activityName} | totalPrice: ${item.totalPrice} -> ${newPrice}`);
      updatedCount++;
    }
  }

  // 8. Sync Invoice Grand Totals
  const invoices = await prisma.invoice.findMany({ include: { items: true } });
  for (const inv of invoices) {
    const calcTotal = roundFloat(inv.items.reduce((sum, i) => sum + i.totalPrice, 0), 2);
    if (hasPrecisionDrift(inv.totalAmount) || inv.totalAmount !== calcTotal) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { totalAmount: calcTotal },
      });
      console.log(`[Synced Invoice] Number: ${inv.invoiceNumber} | totalAmount: ${inv.totalAmount} -> ${calcTotal}`);
      updatedCount++;
    }
  }

  console.log(`\nCleanup complete. Total records updated: ${updatedCount}`);
}

main()
  .catch((e) => {
    console.error('Cleanup error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
