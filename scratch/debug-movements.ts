import { PrismaClient } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const dateStr = "2026-07-13";
  const tzEndDate = endOfDay(parseISO(dateStr));
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  // 1. Get all movements after July 13
  const movementsAfter = await prisma.stockMovement.findMany({
    where: {
      createdAt: { gt: prismaEndDate }
    },
    include: { product: true }
  });

  console.log(`=== movements after July 13: ${movementsAfter.length} ===`);
  for (const m of movementsAfter) {
    console.log(`Movement ID: ${m.id}, Type: ${m.movementType}, Product: ${m.product?.productCode}, Qty: ${m.quantity}, Created: ${m.createdAt.toISOString()}`);
  }

  // 2. Get all movements on/before July 13
  const movementsBefore = await prisma.stockMovement.findMany({
    where: {
      createdAt: { lte: prismaEndDate }
    },
    include: { product: true }
  });

  console.log(`\n=== movements on/before July 13: ${movementsBefore.length} ===`);
  for (const m of movementsBefore) {
    console.log(`Movement ID: ${m.id}, Type: ${m.movementType}, RefType: ${m.referenceType}, Product: ${m.product?.productCode}, Qty: ${m.quantity}, Created: ${m.createdAt.toISOString()}`);
  }

  // 3. Detail the reconstruction
  const stockLedgersDb = await prisma.stockLedger.findMany({
    where: { 
      inboundDate: { lte: prismaEndDate }
    },
    include: { product: true }
  });

  const movementMap = new Map<string, number>();
  const movementsAfterFilter = movementsAfter.filter(m => ["inbound", "outbound", "adjustment"].includes(m.movementType));
  for (const m of movementsAfterFilter) {
    const key = `${m.productId}-${m.palletPositionId || ""}-${m.batchNumber || ""}`;
    let delta = 0;
    if (m.movementType === "inbound") {
      delta = m.quantity;
    } else if (m.movementType === "outbound" || m.movementType === "adjustment") {
      delta = -m.quantity;
    }
    movementMap.set(key, (movementMap.get(key) || 0) + delta);
  }

  console.log(`\n=== Reconstruction Detail ===`);
  for (const sl of stockLedgersDb) {
    const key = `${sl.productId}-${sl.palletPositionId}-${sl.batchNumber || ""}`;
    const netChangeAfter = movementMap.get(key) || 0;
    const reconstructedQty = sl.quantity - netChangeAfter;
    const reconstructedQtyLiter = reconstructedQty * (sl.product?.sizeLiter || 0);
    console.log(`Product: ${sl.product?.productCode}, Ledger Qty Now: ${sl.quantity}, NetChangeAfter: ${netChangeAfter}, Reconstructed Qty: ${reconstructedQty}, Vol: ${reconstructedQtyLiter}L`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
