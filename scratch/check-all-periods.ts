import { PrismaClient } from "@prisma/client";
import { 
  startOfDay, endOfDay, 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth, 
  startOfYear, endOfYear 
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function checkPeriod(period: string) {
  const TIME_ZONE = "Asia/Makassar";
  const realNow = new Date();
  const tzNow = toZonedTime(realNow, TIME_ZONE);

  let tzStartDate: Date;
  let tzEndDate: Date;

  if (period === "daily") {
    tzStartDate = startOfDay(tzNow);
    tzEndDate = endOfDay(tzNow);
  } else if (period === "weekly") {
    tzStartDate = startOfWeek(tzNow, { weekStartsOn: 1 });
    tzEndDate = endOfWeek(tzNow, { weekStartsOn: 1 });
  } else if (period === "monthly") {
    tzStartDate = startOfMonth(tzNow);
    tzEndDate = endOfMonth(tzNow);
  } else if (period === "yearly") {
    tzStartDate = startOfYear(tzNow);
    tzEndDate = endOfYear(tzNow);
  } else {
    return;
  }

  const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  // 1. Fetch Inbound Stock Movements within period
  const inboundMovements = await prisma.stockMovement.findMany({
    where: {
      movementType: "inbound",
      referenceType: "inbound_receipt",
      createdAt: { gte: prismaStartDate, lte: prismaEndDate }
    },
    include: { product: true }
  });
  const totalInboundLiters = inboundMovements.reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);

  // 2. Fetch Outbound
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

  // 3. Stock
  const stockLedgers = await prisma.stockLedger.findMany({
    where: { 
      quantity: { gt: 0 },
      inboundDate: { gte: prismaStartDate, lte: prismaEndDate }
    },
    include: { product: true }
  });
  const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);

  const diff = totalInboundLiters - (totalOutboundLiters + totalWarehouseStock);
  console.log(`Period: ${period}`);
  console.log(`  Inbound: ${totalInboundLiters} L`);
  console.log(`  Outbound: ${totalOutboundLiters} L`);
  console.log(`  Warehouse Stock: ${totalWarehouseStock} L`);
  console.log(`  Outbound + Stock: ${totalOutboundLiters + totalWarehouseStock} L`);
  console.log(`  Difference (Inbound - Expected): ${diff} L`);
}

async function main() {
  await checkPeriod("daily");
  await checkPeriod("weekly");
  await checkPeriod("monthly");
  await checkPeriod("yearly");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
