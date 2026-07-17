import { PrismaClient } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const dateStr = "2026-07-13";
  const tzEndDate = endOfDay(parseISO(dateStr));
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  console.log(`Inspecting stock records as of ${dateStr} end date (UTC: ${prismaEndDate.toISOString()})`);

  // 1. Get all StockLedgers with inboundDate <= prismaEndDate
  const ledgers = await prisma.stockLedger.findMany({
    where: {
      inboundDate: { lte: prismaEndDate }
    },
    include: { product: true }
  });

  console.log(`\nFound ${ledgers.length} StockLedger records.`);

  // 2. Get all StockMovements with createdAt <= prismaEndDate
  const movements = await prisma.stockMovement.findMany({
    where: {
      createdAt: { lte: prismaEndDate }
    },
    include: { product: true }
  });

  console.log(`Found ${movements.length} StockMovement records.`);

  // Let's summarize the ledger counts by ledger ID
  const ledgerMap = new Map<string, any>();
  let ledgerSum = 0;
  for (const l of ledgers) {
    const vol = l.quantity * (l.product?.sizeLiter || 0);
    ledgerSum += vol;
    ledgerMap.set(l.id, {
      id: l.id,
      productCode: l.product?.productCode,
      inboundDate: l.inboundDate,
      quantity: l.quantity,
      vol
    });
  }
  console.log(`Total volume in StockLedger (lte July 13): ${ledgerSum} L`);

  // Let's check which ledgers do not have matching inbound movements before July 13, or if the movement has a different date.
  // Wait, let's look at all inbound receipts received on or before July 13
  const receipts = await prisma.inboundReceipt.findMany({
    where: {
      receivedDate: { lte: prismaEndDate }
    }
  });
  console.log(`\nInboundReceipts lte July 13: ${receipts.length}`);
  for (const r of receipts) {
    console.log(`- Receipt: ${r.receiptNumber}, Date: ${r.receivedDate.toISOString()}, Liters: ${r.totalLiterReceived} L`);
  }

  // Let's check stock movements and find those that are inbound/outbound
  let mInbound = 0;
  let mOutbound = 0;
  let mAdjustment = 0;
  for (const m of movements) {
    const vol = m.quantity * (m.product?.sizeLiter || 0);
    if (m.movementType === "inbound") mInbound += vol;
    else if (m.movementType === "outbound") mOutbound += vol;
    else if (m.movementType === "adjustment") mAdjustment += vol;
  }
  console.log(`\nMovement stats (lte July 13):`);
  console.log(`  Inbound: ${mInbound} L`);
  console.log(`  Outbound: ${mOutbound} L`);
  console.log(`  Adjustment: ${mAdjustment} L`);
  console.log(`  Net: ${mInbound - mOutbound - mAdjustment} L`);

  // Let's print the StockLedgers details
  console.log(`\nDetail of StockLedgers (lte July 13):`);
  for (const l of ledgers) {
    console.log(`- Ledger ID: ${l.id}, Product: ${l.product?.productCode}, Qty: ${l.quantity}, InboundDate: ${l.inboundDate.toISOString()}, Vol: ${l.quantity * (l.product?.sizeLiter || 0)}L`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
