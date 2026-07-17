import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DODetailClient from "./DODetailClient";

export const dynamic = "force-dynamic";

export default async function DODetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.deliveryOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      picker: true,
      driver: true,
      pickingItems: {
        include: { product: true, pickedBy: true },
      },
    },
  });

  if (!order) notFound();

  const session = await getServerSession(authOptions);

  // Fetch DT items (the picking requirements)
  const dtItems = order.deliveryTicketId
    ? await prisma.deliveryTicketItem.findMany({
        where: { deliveryTicketId: order.deliveryTicketId },
        include: { product: true },
        orderBy: { lineNo: "asc" },
      })
    : [];

  // For each DT item, find ALL available stock locations + calculate already picked
  const dtItemsEnriched = await Promise.all(
    dtItems.map(async (item) => {
      const whereClause: any = item.productId
        ? { productId: item.productId, quantity: { gt: 0 } }
        : { product: { productCode: item.productCode }, quantity: { gt: 0 } };

      const stockEntries = await prisma.stockLedger.findMany({
        where: whereClause,
        orderBy: { inboundDate: "asc" }, // FIFO order
        include: {
          palletPosition: {
            include: { rack: { select: { rackCode: true, rackName: true } } },
          },
        },
      });

      // Pre-allocated (pending) DOPickingItems for THIS DO — these reservations belong to us
      const pendingForThisDO = order.pickingItems.filter((pi) => pi.status === "pending");

      // Sum of picked for this DT item from this DO
      const pickedForItem = order.pickingItems.filter(
        (pi) => pi.dtItemId === item.id && pi.status === "shipped"
      );
      const pickedQty = pickedForItem.reduce((sum, pi) => sum + (pi.pickedQty ?? pi.requiredQty), 0);

      return {
        ...item,
        pickedQty,
        deliveredQty: item.deliveredQty ?? 0,
        availableStock: stockEntries.map((s) => {
          // How much was reserved by THIS DO at this specific stock ledger
          const reservedByThisDO = pendingForThisDO
            .filter((pi) => pi.stockLedgerId === s.id)
            .reduce((sum, pi) => sum + pi.requiredQty, 0);

          // Available = total stock - reservations from OTHER orders only
          const otherReservations = Math.max(0, (s.reservedQty ?? 0) - reservedByThisDO);
          const availableQty = Math.max(0, s.quantity - otherReservations);

          return {
            stockLedgerId: s.id,
            positionCode: s.palletPosition.positionCode,
            rackCode: s.palletPosition.rack.rackCode,
            rackName: s.palletPosition.rack.rackName,
            batchNumber: s.batchNumber,
            availableQty,
            totalQty: s.quantity,
            inboundDate: s.inboundDate.toISOString(),
          };
        }).filter((s) => s.availableQty > 0), // hide locations with 0 availability
      };
    })
  );

  // Already shipped picking items (for the picked section)
  const shippedPickingItems = order.pickingItems.filter((pi) => pi.status === "shipped");

  const serializable = JSON.parse(
    JSON.stringify({
      order: {
        id: order.id,
        doNumber: order.doNumber,
        status: order.status,
        destination: order.destination,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        customer: order.customer,
        picker: order.picker,
        currentUserName: session?.user?.name ?? session?.user?.email ?? "—",
      },
      dtItems: dtItemsEnriched,
      shippedItems: shippedPickingItems,
    })
  );

  return <DODetailClient data={serializable} />;
}
