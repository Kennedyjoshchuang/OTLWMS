const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== SEARCHING ALL TABLES FOR JUNE 18 & VALUES NEAR 4609 ===\n');

  // Search PackingList
  const plList = await prisma.packingList.findMany({ include: { items: { include: { product: true } } } });
  for (const pl of plList) {
    const dateStr = new Date(pl.inboundDate).toISOString();
    if (dateStr.includes('06-18') || dateStr.includes('18-06')) {
      console.log(`[PackingList] PL: ${pl.plNumber} | inboundDate: ${dateStr} | expectedTotalLiter: ${pl.expectedTotalLiter}`);
      let sumLiters = 0;
      for (const item of pl.items) {
        const calc = item.expectedQty * (item.product?.sizeLiter || 0);
        sumLiters += calc;
        console.log(`   -> Item ${item.productCode} (${item.productName}) | Qty: ${item.expectedQty} | sizeLiter: ${item.product?.sizeLiter} | calc: ${calc}`);
      }
      console.log(`   --> Total Sum of items Qty * sizeLiter: ${sumLiters}`);
    }
  }

  // Search DeliveryTicket
  const dtList = await prisma.deliveryTicket.findMany({ include: { items: { include: { product: true } } } });
  for (const dt of dtList) {
    const dStr = dt.deliveryDate ? new Date(dt.deliveryDate).toISOString() : '';
    const oStr = dt.orderDate ? new Date(dt.orderDate).toISOString() : '';
    const cStr = new Date(dt.createdAt).toISOString();
    if (dStr.includes('06-18') || oStr.includes('06-18') || cStr.includes('06-18')) {
      console.log(`[DeliveryTicket] DT: ${dt.dtNumber} | Dates (del/ord/created): ${dStr} / ${oStr} / ${cStr} | totalLiter: ${dt.totalLiter} | totalGrossKg: ${dt.totalGrossKg}`);
      let sumLiters = 0;
      let sumCalculated = 0;
      for (const item of dt.items) {
        const p = item.product;
        const calc = item.delQtyPcs * (p?.sizeLiter || 0);
        sumLiters += (item.delQtyLiter || 0);
        sumCalculated += calc;
        console.log(`   -> Item ${item.productCode} (${item.productName}) | delQtyPcs: ${item.delQtyPcs} | delQtyLiter: ${item.delQtyLiter} | product sizeLiter: ${p?.sizeLiter} | Pcs * sizeLiter: ${calc}`);
      }
      console.log(`   --> Sum of delQtyLiter: ${sumLiters} | totalGrossKg (*1.3): ${sumLiters * 1.3}`);
      console.log(`   --> Sum of (Pcs * sizeLiter): ${sumCalculated} | grossKg (*1.3): ${sumCalculated * 1.3}`);
    }
  }

  // Search DeliveryOrder
  const doList = await prisma.deliveryOrder.findMany({ include: { deliveryTicket: { include: { items: { include: { product: true } } } } } });
  for (const dOrder of doList) {
    const dates = [dOrder.deliveryDate, dOrder.pickingStartedAt, dOrder.shippedAt, dOrder.deliveredAt, dOrder.createdAt]
      .filter(Boolean)
      .map(d => new Date(d).toISOString())
      .join(' | ');
    if (dates.includes('06-18')) {
      console.log(`[DeliveryOrder] DO: ${dOrder.doNumber} | Dates: ${dates}`);
      let sumLiters = 0;
      for (const item of (dOrder.deliveryTicket?.items || [])) {
        const p = item.product;
        const calc = item.delQtyPcs * (p?.sizeLiter || 0);
        sumLiters += calc;
        console.log(`   -> Item ${item.productCode} (${item.productName}) | Pcs: ${item.delQtyPcs} | sizeLiter: ${p?.sizeLiter} | calc: ${calc}`);
      }
      console.log(`   --> Total sum: ${sumLiters}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
