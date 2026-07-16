import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing analytics data...");
  const inbounds = await prisma.inboundReceipt.findMany();
  const totalInboundFromReceipts = inbounds.reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);
  console.log("Total Inbound from InboundReceipt (all time):", totalInboundFromReceipts);

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: { product: true }
  });
  const totalStockInLiters = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);
  console.log("Total Current Stock in Warehouse (all time):", totalStockInLiters);

  const outbounds = await prisma.deliveryOrder.findMany({
    where: { status: "delivered" },
    include: {
      deliveryTicket: {
        include: { items: { include: { product: true } } }
      }
    }
  });
  const calcOutboundLiter = (o: any) => o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.delQtyPcs * (it.product?.sizeLiter || 0)), 0) || 0;
  const totalOutboundDelivered = outbounds.reduce((sum, o) => sum + calcOutboundLiter(o), 0);
  console.log("Total Outbound Delivered (all time):", totalOutboundDelivered);

  console.log("Mathematically: Inbound should be Outbound + Current Stock");
  console.log(`Outbound (${totalOutboundDelivered}) + Stock (${totalStockInLiters}) = ${totalOutboundDelivered + totalStockInLiters}`);
  console.log("Difference:", totalInboundFromReceipts - (totalOutboundDelivered + totalStockInLiters));

  // Let's print each receipt and compare it with the stock ledger that belongs to it, and any outbound movements for its stock.
  for (const receipt of inbounds) {
    const ledgers = await prisma.stockLedger.findMany({
      where: { inboundReceiptId: receipt.id },
      include: { product: true }
    });

    const ledgerQtyLiter = ledgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);

    let shippedLiterForReceipt = 0;
    let otherPicksLiterForReceipt = 0;
    
    const pickingItems = await prisma.dOPickingItem.findMany({
      where: { stockLedgerId: { in: ledgers.map(l => l.id) } },
      include: {
        product: true,
        deliveryOrder: true
      }
    });

    for (const pi of pickingItems) {
      const isShippedOrDelivered = pi.deliveryOrder.status === "shipped" || pi.deliveryOrder.status === "delivered";
      const pickedLiter = pi.pickedQty * (pi.product?.sizeLiter || 0);
      if (isShippedOrDelivered) {
        shippedLiterForReceipt += pickedLiter;
      } else {
        otherPicksLiterForReceipt += pickedLiter;
      }
    }

    const expectedStockFromReceipt = receipt.totalLiterReceived - shippedLiterForReceipt;
    const diff = Math.abs(expectedStockFromReceipt - ledgerQtyLiter);
    
    if (diff > 0.001) {
      console.log(`\nMismatch in Receipt ${receipt.receiptNumber} (${receipt.receivedDate}):`);
      console.log(`  Received: ${receipt.totalLiterReceived} L`);
      console.log(`  Current stock in ledger: ${ledgerQtyLiter} L`);
      console.log(`  Shipped: ${shippedLiterForReceipt} L`);
      console.log(`  Other picks: ${otherPicksLiterForReceipt} L`);
      console.log(`  Diff: ${diff} L`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
