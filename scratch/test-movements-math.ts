import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Analyzing stock movements vs current stock ledger...");

  const products = await prisma.product.findMany();
  
  let totalInboundPcs = 0;
  let totalOutboundPcs = 0;
  let totalAdjustmentPcs = 0;
  let totalCurrentStockPcs = 0;

  // Let's sum all inbound movements
  const inboundMovements = await prisma.stockMovement.findMany({
    where: { movementType: "inbound" }
  });
  totalInboundPcs = inboundMovements.reduce((sum, m) => sum + m.quantity, 0);

  // Let's sum all outbound movements
  const outboundMovements = await prisma.stockMovement.findMany({
    where: { movementType: "outbound" }
  });
  totalOutboundPcs = outboundMovements.reduce((sum, m) => sum + m.quantity, 0);

  // Let's sum all adjustment movements
  const adjustmentMovements = await prisma.stockMovement.findMany({
    where: { movementType: "adjustment" }
  });
  totalAdjustmentPcs = adjustmentMovements.reduce((sum, m) => sum + m.quantity, 0);

  // Let's sum current stock ledger
  const stockLedgers = await prisma.stockLedger.findMany();
  totalCurrentStockPcs = stockLedgers.reduce((sum, sl) => sum + sl.quantity, 0);

  console.log("--- Pcs Summary ---");
  console.log("Total Inbound Movements (Pcs):", totalInboundPcs);
  console.log("Total Outbound Movements (Pcs):", totalOutboundPcs);
  console.log("Total Adjustment Movements (Pcs):", totalAdjustmentPcs);
  console.log("Total Current Stock (Pcs):", totalCurrentStockPcs);
  
  const expectedPcs = totalOutboundPcs + totalAdjustmentPcs + totalCurrentStockPcs;
  console.log("Expected Inbound (Outbound + Adjustment + Stock):", expectedPcs);
  console.log("Discrepancy (Inbound - Expected):", totalInboundPcs - expectedPcs);

  // Let's check by product
  console.log("\nChecking per product discrepancies...");
  for (const p of products) {
    const pInbound = inboundMovements.filter(m => m.productId === p.id).reduce((sum, m) => sum + m.quantity, 0);
    const pOutbound = outboundMovements.filter(m => m.productId === p.id).reduce((sum, m) => sum + m.quantity, 0);
    const pAdjustment = adjustmentMovements.filter(m => m.productId === p.id).reduce((sum, m) => sum + m.quantity, 0);
    const pStock = stockLedgers.filter(sl => sl.productId === p.id).reduce((sum, sl) => sum + sl.quantity, 0);

    const diff = pInbound - (pOutbound + pAdjustment + pStock);
    if (diff !== 0) {
      console.log(`Product: ${p.productCode} (${p.productName}):`);
      console.log(`  Inbound: ${pInbound} pcs (${pInbound * (p.sizeLiter || 0)} L)`);
      console.log(`  Outbound: ${pOutbound} pcs (${pOutbound * (p.sizeLiter || 0)} L)`);
      console.log(`  Adjustment: ${pAdjustment} pcs (${pAdjustment * (p.sizeLiter || 0)} L)`);
      console.log(`  Stock: ${pStock} pcs (${pStock * (p.sizeLiter || 0)} L)`);
      console.log(`  Difference: ${diff} pcs (${diff * (p.sizeLiter || 0)} L)`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
