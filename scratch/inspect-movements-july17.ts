import { PrismaClient } from "@prisma/client";
import { startOfDay, endOfDay, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const prisma = new PrismaClient();

async function main() {
  const TIME_ZONE = "Asia/Makassar";
  const startParam = "2026-07-17";
  const tzStartDate = startOfDay(toZonedTime(new Date(startParam + "T00:00:00Z"), TIME_ZONE));
  const tzEndDate = endOfDay(toZonedTime(new Date(startParam + "T12:00:00Z"), TIME_ZONE));

  const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
  const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

  console.log(`Checking movements and orders on July 17 (UTC: ${prismaStartDate.toISOString()} to ${prismaEndDate.toISOString()})`);

  // Outbound movements on July 17
  const movements = await prisma.stockMovement.findMany({
    where: {
      movementType: "outbound",
      createdAt: { gte: prismaStartDate, lte: prismaEndDate }
    },
    include: { product: true }
  });

  console.log(`\n=== Outbound movements on July 17: ${movements.length} ===`);
  for (const m of movements) {
    console.log(`Movement ID: ${m.id}, Product: ${m.product?.productCode}, Qty: ${m.quantity}, Size: ${m.product?.sizeLiter}L, Total: ${m.quantity * (m.product?.sizeLiter || 0)}L, Created: ${m.createdAt.toISOString()}`);
  }

  // Delivery orders created or updated to outbound status on July 17
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

  console.log(`\n=== Delivery Orders on July 17: ${outbounds.length} ===`);
  for (const o of outbounds) {
    const vol = o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.deliveredQty * (it.product?.sizeLiter || 0)), 0) || 0;
    console.log(`DO: ${o.doNumber}, Status: ${o.status}, Vol: ${vol}L, CreatedAt: ${o.createdAt.toISOString()}, DelAt: ${o.deliveredAt?.toISOString()}, ShippedAt: ${o.shippedAt?.toISOString()}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
