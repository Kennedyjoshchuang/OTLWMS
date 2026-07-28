import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const codes = ['6HUMAWUVA', '2BW001WVA', '6ZJMAWUVA'];

  console.log("=== CHECKING PRODUCTS ===");
  const products = await prisma.product.findMany({
    where: {
      OR: codes.map(c => ({
        productCode: { contains: c, mode: 'insensitive' }
      }))
    },
    include: {
      customer: true
    }
  });

  console.log(`Found ${products.length} products:`);
  for (const p of products) {
    console.log(`- ID: ${p.id} | Code: ${p.productCode} | Name: ${p.productName} | Liter: ${p.sizeLiter} | Customer: ${p.customer.name}`);
  }

  const targetProductIds = products.map(p => p.id);

  console.log("\n=== WAREHOUSE MAP (STOCK LEDGERS) ===");
  const stockLedgers = await prisma.stockLedger.findMany({
    where: { productId: { in: targetProductIds } },
    include: {
      palletPosition: true,
      inboundReceipt: true,
      product: true,
    }
  });

  for (const sl of stockLedgers) {
    console.log(`[StockLedger ${sl.id}] Product: ${sl.product.productCode} | Pos: ${sl.palletPosition.positionCode} | Qty: ${sl.quantity} | Liter: ${sl.quantityLiter} | ReservedQty: ${sl.reservedQty} | IsReserved: ${sl.isReserved} | InboundDate: ${sl.inboundDate?.toISOString()}`);
  }

  console.log("\n=== DELIVERY TICKET ITEMS (SYSTEM OUTBOUND DEMAND/ORDERS) ===");
  const dtItems = await prisma.deliveryTicketItem.findMany({
    where: {
      OR: [
        { productId: { in: targetProductIds } },
        ...codes.map(c => ({ productCode: { contains: c, mode: 'insensitive' as const } }))
      ]
    },
    include: {
      deliveryTicket: true,
      product: true,
    }
  });

  for (const item of dtItems) {
    console.log(`[DTItem ${item.id}] DT: ${item.deliveryTicket.dtNumber} (Status: ${item.deliveryTicket.status}) | ProductCode: ${item.productCode} | LineNo: ${item.lineNo} | DelQtyPcs: ${item.delQtyPcs} | DelQtyLiter: ${item.delQtyLiter} | DeliveredQty: ${item.deliveredQty} | Status: ${item.status}`);
  }

  console.log("\n=== DO PICKING ITEMS ===");
  const pickingItems = await prisma.dOPickingItem.findMany({
    where: { productId: { in: targetProductIds } },
    include: {
      deliveryOrder: true,
      palletPosition: true,
      stockLedger: true,
      product: true,
    }
  });

  for (const pi of pickingItems) {
    console.log(`[PickingItem ${pi.id}] DO: ${pi.deliveryOrder.doNumber} (DO Status: ${pi.deliveryOrder.status}) | Product: ${pi.product.productCode} | Pos: ${pi.positionCode} | ReqQty: ${pi.requiredQty} | PickedQty: ${pi.pickedQty} | ScanConfirmed: ${pi.scanConfirmed} | Status: ${pi.status} | StockLedgerId: ${pi.stockLedgerId}`);
  }

  console.log("\n=== STOCK MOVEMENTS ===");
  const movements = await prisma.stockMovement.findMany({
    where: { productId: { in: targetProductIds } },
    orderBy: { createdAt: 'asc' },
    include: {
      product: true
    }
  });

  for (const m of movements) {
    console.log(`[Movement ${m.id}] Product: ${m.product.productCode} | Type: ${m.movementType} | Qty: ${m.quantity} (${m.quantityBefore} -> ${m.quantityAfter}) | RefType: ${m.referenceType} | RefId: ${m.referenceId} | Date: ${m.createdAt.toISOString()}`);
  }

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
