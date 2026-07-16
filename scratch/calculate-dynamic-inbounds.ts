import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Testing recalculation of inbound liters using StockMovement and current Product sizes...");

  const receipts = await prisma.inboundReceipt.findMany();
  let totalStoredInboundLiter = 0;
  let totalRecalculatedInboundLiter = 0;

  for (const receipt of receipts) {
    totalStoredInboundLiter += receipt.totalLiterReceived;

    // Find all inbound movements for this receipt
    const movements = await prisma.stockMovement.findMany({
      where: {
        movementType: "inbound",
        referenceType: "inbound_receipt",
        referenceId: receipt.id
      },
      include: { product: true }
    });

    const recalculatedLiter = movements.reduce((sum, m) => {
      const size = m.product?.sizeLiter || 0;
      return sum + (m.quantity * size);
    }, 0);

    totalRecalculatedInboundLiter += recalculatedLiter;

    const diff = Math.abs(receipt.totalLiterReceived - recalculatedLiter);
    if (diff > 0.001) {
      console.log(`Receipt ${receipt.receiptNumber} (${receipt.createdAt}):`);
      console.log(`  Stored Inbound Liter: ${receipt.totalLiterReceived} L`);
      console.log(`  Recalculated Inbound Liter: ${recalculatedLiter} L`);
      console.log(`  Difference: ${diff} L`);
      console.log("  Movements:");
      for (const m of movements) {
        console.log(`    - Product: ${m.product?.productCode}, Qty: ${m.quantity}, Size: ${m.product?.sizeLiter} L`);
      }
    }
  }

  console.log("\n--- Global Totals ---");
  console.log("Total Stored Inbound Liters:", totalStoredInboundLiter);
  console.log("Total Recalculated Inbound Liters:", totalRecalculatedInboundLiter);

  const stockLedgers = await prisma.stockLedger.findMany({
    where: { quantity: { gt: 0 } },
    include: { product: true }
  });
  const totalStockInLiters = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);
  console.log("Total Current Stock in Warehouse:", totalStockInLiters);

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
  console.log("Total Outbound Delivered:", totalOutboundDelivered);

  console.log("\nMathematically: Inbound should be Outbound + Current Stock");
  console.log(`Outbound (${totalOutboundDelivered}) + Stock (${totalStockInLiters}) = ${totalOutboundDelivered + totalStockInLiters}`);
  console.log("Diff with Stored Inbound:", totalStoredInboundLiter - (totalOutboundDelivered + totalStockInLiters));
  console.log("Diff with Recalculated Inbound:", totalRecalculatedInboundLiter - (totalOutboundDelivered + totalStockInLiters));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
