import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import OmegaDTPrintPageClient from "./OmegaDTPrintPageClient";

export const dynamic = "force-dynamic";

export default async function PrintOmegaDTPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // id here is the DeliveryOrder id — look up the related DeliveryTicket
  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      customer: true,
    },
  });

  if (!order || !order.deliveryTicketId) notFound();

  const ticket = await prisma.deliveryTicket.findUnique({
    where: { id: order.deliveryTicketId },
    include: {
      customer: true,
      items: {
        orderBy: { lineNo: "asc" },
        include: { product: true },
      },
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

  return <OmegaDTPrintPageClient ticket={serializable} />;
}
