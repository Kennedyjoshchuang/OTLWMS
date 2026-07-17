import { PrismaClient } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const dateStr = "2026-07-13";
  
  const tzStartDate = startOfDay(parseISO(dateStr));
  const tzEndDate = endOfDay(parseISO(dateStr));

  const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  console.log(`Checking stats for Date: ${dateStr} (${TIME_ZONE})`);

  // Fetch active reference IDs
  const activeDOs = await prisma.deliveryOrder.findMany({ select: { id: true } });
  const activeDOIds = new Set(activeDOs.map(d => d.id));

  const activeReceipts = await prisma.inboundReceipt.findMany({ select: { id: true } });
  const activeReceiptIds = new Set(activeReceipts.map(r => r.id));

  // Helper to validate movement
  const isMovementValid = (m: any): boolean => {
    if (!m.referenceType || !m.referenceId) return true;
    if (m.referenceType === "delivery_order" || m.referenceType === "delivery_order_reversal") {
      return activeDOIds.has(m.referenceId);
    }
    if (m.referenceType === "inbound_receipt") {
      return activeReceiptIds.has(m.referenceId);
    }
    return true;
  };

  // 1. Fetch Inbound Receipt Liter on July 13, 2026
  const inboundMovements = await prisma.stockMovement.findMany({
    where: {
      movementType: "inbound",
      referenceType: "inbound_receipt",
      createdAt: { gte: prismaStartDate, lte: prismaEndDate }
    },
    include: { product: true }
  });

  const validInboundMovements = inboundMovements.filter(isMovementValid);
  const totalInboundLiters = validInboundMovements.reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
  console.log(`Total Inbound Liters: ${totalInboundLiters} L`);

  // 2. Fetch Outbound on July 13, 2026
  const outbounds = await prisma.deliveryOrder.findMany({
    where: {
      OR: [
        { createdAt: { gte: prismaStartDate, lte: prismaEndDate } },
        { deliveryDate: { gte: prismaStartDate, lte: prismaEndDate } },
        { shippedAt: { gte: prismaStartDate, lte: prismaEndDate } },
        { deliveredAt: { gte: prismaStartDate, lte: prismaEndDate } }
      ]
    },
    include: {
      deliveryTicket: {
        include: { items: { include: { product: true } } }
      }
    }
  });

  const getDORelevantDate = (o: any): Date => {
    if (o.status === "on_delivery") {
      return o.shippedAt || o.deliveryDate || o.createdAt;
    }
    return o.deliveredAt || o.shippedAt || o.deliveryDate || o.createdAt;
  };

  const deliveredDOs = outbounds.filter(o => {
    const isOutboundStatus = ["delivered", "on_delivery", "partially_delivered"].includes(o.status);
    if (!isOutboundStatus) return false;
    const relevantDate = getDORelevantDate(o);
    return relevantDate >= prismaStartDate && relevantDate <= prismaEndDate;
  });

  const calcOutboundLiter = (o: any) => o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.deliveredQty * (it.product?.sizeLiter || 0)), 0) || 0;
  const totalOutboundLiters = deliveredDOs.reduce((sum, o) => sum + calcOutboundLiter(o), 0);
  console.log(`Total Outbound Liters: ${totalOutboundLiters} L`);

  // 3. Reconstruct Warehouse Stock at End of July 13, 2026
  const stockLedgersDb = await prisma.stockLedger.findMany({
    where: { 
      inboundDate: { lte: prismaEndDate }
    },
    include: { 
      product: true,
      palletPosition: {
        include: { rack: true }
      }
    }
  });

  // Filter out stock ledgers that belong to deleted inbound receipts
  const validStockLedgersDb = stockLedgersDb.filter(sl => {
    if (!sl.inboundReceiptId) return true;
    return activeReceiptIds.has(sl.inboundReceiptId);
  });

  const movementsAfter = await prisma.stockMovement.findMany({
    where: {
      createdAt: { gt: prismaEndDate },
      movementType: { in: ["inbound", "outbound", "adjustment"] }
    }
  });

  const validMovementsAfter = movementsAfter.filter(isMovementValid);

  const movementMap = new Map<string, number>();
  for (const m of validMovementsAfter) {
    const key = `${m.productId}-${m.palletPositionId || ""}-${m.batchNumber || ""}`;
    let delta = 0;
    if (m.movementType === "inbound") {
      delta = m.quantity;
    } else if (m.movementType === "outbound" || m.movementType === "adjustment") {
      delta = -m.quantity;
    }
    movementMap.set(key, (movementMap.get(key) || 0) + delta);
  }

  const stockLedgers = validStockLedgersDb.map(sl => {
    const key = `${sl.productId}-${sl.palletPositionId}-${sl.batchNumber || ""}`;
    const netChangeAfter = movementMap.get(key) || 0;
    const reconstructedQty = sl.quantity - netChangeAfter;
    const reconstructedQtyLiter = reconstructedQty * (sl.product?.sizeLiter || 0);

    return {
      ...sl,
      quantity: reconstructedQty,
      quantityLiter: reconstructedQtyLiter
    };
  }).filter(sl => sl.quantity > 0);

  const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);
  console.log(`Reconstructed Warehouse Stock at end of July 13: ${totalWarehouseStock} L`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
