import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const codes = ['6HUMAWUVA', '2BW001WVA', '6ZJMAWUVA'];

  const products = await prisma.product.findMany({
    where: {
      OR: codes.map(c => ({ productCode: { contains: c, mode: 'insensitive' } }))
    }
  });

  for (const p of products) {
    console.log(`\n======================================================`);
    console.log(`PRODUCT: ${p.productCode} (${p.productName})`);
    console.log(`Product ID: ${p.id} | Size Liter: ${p.sizeLiter} L`);
    console.log(`======================================================`);

    // 1. StockLedger (Warehouse Map)
    const ledgers = await prisma.stockLedger.findMany({
      where: { productId: p.id },
      include: { palletPosition: true }
    });

    const activeStockPcs = ledgers.reduce((sum, l) => sum + l.quantity, 0);
    const activeStockLiter = activeStockPcs * (p.sizeLiter || 0);
    const totalReservedPcs = ledgers.reduce((sum, l) => sum + l.reservedQty, 0);

    console.log(`\n[WAREHOUSE MAP / STOCK LEDGER]`);
    console.log(`- Current Active Physical Stock: ${activeStockPcs} pcs (${activeStockLiter} L)`);
    console.log(`- Total Reserved Qty in Ledgers: ${totalReservedPcs} pcs`);
    console.log(`- Stock Ledger Entries breakdown:`);
    for (const l of ledgers) {
      console.log(`   * Ledger ${l.id} @ ${l.palletPosition?.positionCode || 'N/A'}: Qty=${l.quantity} pcs, Reserved=${l.reservedQty} pcs, IsReserved=${l.isReserved}, Batch=${l.batchNumber || 'N/A'}`);
    }

    // 2. Inbound Receipts / Movements
    const inboundMovements = await prisma.stockMovement.findMany({
      where: { productId: p.id, movementType: 'inbound' }
    });
    const totalInboundPcs = inboundMovements.reduce((sum, m) => sum + m.quantity, 0);
    console.log(`\n[INBOUND]`);
    console.log(`- Total Inbound Movements Qty: ${totalInboundPcs} pcs (${totalInboundPcs * (p.sizeLiter || 0)} L)`);

    // 3. System Outbound
    const dtItems = await prisma.deliveryTicketItem.findMany({
      where: {
        OR: [
          { productId: p.id },
          { productCode: p.productCode }
        ]
      },
      include: { deliveryTicket: true }
    });

    const dtTotalOrderedPcs = dtItems.reduce((sum, i) => sum + i.delQtyPcs, 0);
    const dtTotalDeliveredPcs = dtItems.reduce((sum, i) => sum + i.deliveredQty, 0);

    console.log(`\n[DELIVERY TICKETS / SYSTEM OUTBOUND DEMAND]`);
    console.log(`- Total Ordered Qty in DTs (delQtyPcs): ${dtTotalOrderedPcs} pcs (${dtTotalOrderedPcs * (p.sizeLiter || 0)} L)`);
    console.log(`- Total Delivered Qty in DTs (deliveredQty): ${dtTotalDeliveredPcs} pcs (${dtTotalDeliveredPcs * (p.sizeLiter || 0)} L)`);
    for (const dti of dtItems) {
      console.log(`   * DT #${dti.deliveryTicket.dtNumber} (${dti.deliveryTicket.status}): delQtyPcs=${dti.delQtyPcs}, deliveredQty=${dti.deliveredQty}, status=${dti.status}`);
    }

    // 4. Picking Items & Stock Movements Outbound
    const pickingItems = await prisma.dOPickingItem.findMany({
      where: { productId: p.id },
      include: { deliveryOrder: true }
    });

    const pendingPickingPcs = pickingItems.filter(pi => pi.status === 'pending').reduce((sum, pi) => sum + pi.requiredQty, 0);
    const shippedPickingPcs = pickingItems.filter(pi => pi.status === 'shipped').reduce((sum, pi) => sum + pi.pickedQty, 0);

    console.log(`\n[DO PICKING ITEMS]`);
    console.log(`- Pending Picking Qty (status=pending): ${pendingPickingPcs} pcs`);
    console.log(`- Shipped Picking Qty (status=shipped): ${shippedPickingPcs} pcs`);
    for (const pi of pickingItems) {
      console.log(`   * DO #${pi.deliveryOrder.doNumber} (DO Status: ${pi.deliveryOrder.status}): status=${pi.status}, ReqQty=${pi.requiredQty}, PickedQty=${pi.pickedQty}, StockLedgerId=${pi.stockLedgerId}, Pos=${pi.positionCode}`);
    }

    const outboundMovements = await prisma.stockMovement.findMany({
      where: { productId: p.id, movementType: 'outbound' }
    });
    const totalOutboundMovementPcs = outboundMovements.reduce((sum, m) => sum + m.quantity, 0);

    console.log(`\n[STOCK MOVEMENTS - OUTBOUND]`);
    console.log(`- Total Outbound Movement Qty: ${totalOutboundMovementPcs} pcs (${totalOutboundMovementPcs * (p.sizeLiter || 0)} L)`);

    console.log(`\n[SUMMARY EQUATION RECONCILIATION FOR ${p.productCode}]`);
    console.log(`  Inbound (${totalInboundPcs}) - Outbound Movements (${totalOutboundMovementPcs}) = ${totalInboundPcs - totalOutboundMovementPcs} pcs`);
    console.log(`  Current Warehouse Map Physical Stock = ${activeStockPcs} pcs`);
    console.log(`  DT Delivered Qty = ${dtTotalDeliveredPcs} pcs`);
    console.log(`  Difference (Inbound - DT Delivered vs Current Warehouse Stock):`);
    console.log(`    Expected Stock if Outbound = DT Delivered: ${totalInboundPcs - dtTotalDeliveredPcs} pcs vs Actual Stock: ${activeStockPcs} pcs`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
