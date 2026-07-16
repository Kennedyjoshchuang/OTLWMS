import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import DeliveryTicketDetailClient from "./DeliveryTicketDetailClient";

export default async function DeliveryTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await prisma.deliveryTicket.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { fullName: true } },
      items: {
        orderBy: { lineNo: "asc" },
        include: {
          product: true,
          pickingItems: {
            select: {
              pickedQty: true,
            },
          },
        },
      },
      deliveryOrders: {
        select: { id: true, doNumber: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  if (!ticket) notFound();

  // For each item, look up FIFO stock locations
  const itemsWithLocations = await Promise.all(
    ticket.items.map(async (item) => {
      const whereClause: any = item.productId
        ? { productId: item.productId, quantity: { gt: 0 } }
        : { product: { productCode: item.productCode }, quantity: { gt: 0 } };

      const stockEntries = await prisma.stockLedger.findMany({
        where: whereClause,
        orderBy: { inboundDate: "asc" },
        include: {
          palletPosition: {
            include: { rack: { select: { rackCode: true, rackName: true } } },
          },
        },
      });

      return {
        ...item,
        locations: stockEntries.map((s) => ({
          positionCode: s.palletPosition.positionCode,
          rackCode: s.palletPosition.rack.rackCode,
          rackName: s.palletPosition.rack.rackName,
          batchNumber: s.batchNumber,
          availableQty: s.quantity - s.reservedQty,
          inboundDate: s.inboundDate.toISOString(),
        })),
      };
    })
  );

  const serializable = JSON.parse(
    JSON.stringify({ ...ticket, items: itemsWithLocations })
  );

  return <DeliveryTicketDetailClient ticket={serializable} />;
}
