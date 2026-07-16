import { PrismaClient } from "@prisma/client";
import { startOfYear, endOfYear } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const realNow = new Date();
  const tzNow = toZonedTime(realNow, TIME_ZONE);

  const tzStartDate = startOfYear(tzNow);
  const tzEndDate = endOfYear(tzNow);

  const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  console.log("Start Date:", prismaStartDate.toISOString());
  console.log("End Date:", prismaEndDate.toISOString());

  // 1. Fetch Inbound (GRN) within period
  const inbounds = await prisma.inboundReceipt.findMany({
    where: { createdAt: { gte: prismaStartDate, lte: prismaEndDate } }
  });
  const totalInboundLiters = inbounds.reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);

  // 2. Fetch Outbound (DO) within period based on creation or delivery
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
      customer: true, 
      deliveryTicket: {
        include: { items: { include: { product: true } } }
      }
    }
  });

  const getDORelevantDate = (o: any): Date => {
    return o.deliveredAt || o.shippedAt || o.deliveryDate || o.createdAt;
  };

  const deliveredDOs = outbounds.filter(o => {
    const isDeliveredStatus = o.status === "delivered" || o.status === "on_delivery";
    if (!isDeliveredStatus) return false;
    const relevantDate = getDORelevantDate(o);
    return relevantDate >= prismaStartDate && relevantDate <= prismaEndDate;
  });

  const calcOutboundLiter = (o: any) => o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.delQtyPcs * (it.product?.sizeLiter || 0)), 0) || 0;
  const totalOutboundLiters = deliveredDOs.reduce((sum, o) => sum + calcOutboundLiter(o), 0);

  // 3. Warehouse Stock
  const stockLedgers = await prisma.stockLedger.findMany({
    where: { 
      quantity: { gt: 0 },
      inboundDate: { gte: prismaStartDate, lte: prismaEndDate }
    },
    include: { product: true }
  });
  const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);

  console.log("\n--- Analytics API Output Simulation ---");
  console.log("Inbound Liter Card:", totalInboundLiters);
  console.log("Outbound Liter Card:", totalOutboundLiters);
  console.log("Warehouse Stock Card:", totalWarehouseStock);

  console.log("\n--- Recalculated Inbound (using current sizes) ---");
  let totalRecalculatedInboundLiter = 0;
  for (const receipt of inbounds) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        movementType: "inbound",
        referenceType: "inbound_receipt",
        referenceId: receipt.id
      },
      include: { product: true }
    });
    totalRecalculatedInboundLiter += movements.reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
  }
  console.log("Recalculated Inbound Liter:", totalRecalculatedInboundLiter);

  console.log("\n--- Math Checks ---");
  console.log("Expected Inbound (Outbound + Stock):", totalOutboundLiters + totalWarehouseStock);
  console.log("Difference (Stored Inbound - Expected):", totalInboundLiters - (totalOutboundLiters + totalWarehouseStock));
  console.log("Difference (Recalculated Inbound - Expected):", totalRecalculatedInboundLiter - (totalOutboundLiters + totalWarehouseStock));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
