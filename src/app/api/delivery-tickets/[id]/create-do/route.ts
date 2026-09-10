import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateDO } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Run in a transaction
    const deliveryOrder = await prisma.$transaction(
      async (tx) => {
      // Lock DeliveryTicket row to serialize concurrent create-do requests on the same ticket
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DeliveryTicket" WHERE id = ${id} FOR UPDATE`
      );

      // 1. Fetch DT
      const ticket = await tx.deliveryTicket.findUnique({
        where: { id },
        include: { items: true, deliveryOrders: true },
      });

      if (!ticket) {
        throw new Error("Delivery Ticket not found.");
      }

      if (ticket.deliveryOrders.length > 0) {
        return ticket.deliveryOrders[0];
      }

      // 2. Generate DO Number (with row lock on prefix to prevent sequence collision)
      const year = new Date().getFullYear();
      const prefix = `OTL-PL-${year}-`;
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DeliveryOrder" WHERE "doNumber" LIKE ${prefix + '%'} ORDER BY "doNumber" DESC LIMIT 1 FOR UPDATE`
      );
      const latestDO = await tx.deliveryOrder.findFirst({
        where: {
          doNumber: {
            startsWith: prefix,
          },
        },
        orderBy: {
          doNumber: "desc",
        },
      });

      let nextSeq = 1;
      if (latestDO) {
        const parts = latestDO.doNumber.split("-");
        const seqStr = parts[parts.length - 1];
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
      const doNumber = generateDO(nextSeq);

      // 3. Create DO
      const newDO = await tx.deliveryOrder.create({
        data: {
          doNumber,
          deliveryTicketId: ticket.id,
          customerId: ticket.customerId,
          destination: ticket.deliverToAddress || ticket.deliverToName || "Unknown Destination",
          status: "draft",
        },
      });

      // 4. Allocate picking items from StockLedger
      // Pre-resolve any missing productIds on DT items before allocation
      for (const item of ticket.items) {
        if (!item.productId && item.productCode) {
          const matchedProduct = await tx.product.findFirst({
            where: { customerId: ticket.customerId, productCode: item.productCode },
          });
          if (matchedProduct) {
            item.productId = matchedProduct.id;
            await tx.deliveryTicketItem.update({
              where: { id: item.id },
              data: { productId: matchedProduct.id },
            });
          }
        }
      }

      const productIds = ticket.items
        .map((item) => item.productId)
        .filter((id): id is string => !!id);

      if (productIds.length > 0) {
        // Exclusively lock candidate StockLedger rows to prevent concurrent DO creations from double-allocating stock
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "StockLedger" WHERE "productId" IN (${Prisma.join(productIds)}) AND "quantity" > 0 FOR UPDATE`
        );
      }

      const allStockEntries = await tx.stockLedger.findMany({
        where: {
          productId: { in: productIds },
          quantity: { gt: 0 },
        },
        orderBy: [
          { inboundDate: "asc" },
          { createdAt: "asc" },
          { id: "asc" },
        ],
        include: { palletPosition: true },
      });

      for (const item of ticket.items) {
        if (!item.productId || item.delQtyPcs <= 0) continue;

        let requiredQty = item.delQtyPcs;

        // Find available stock for this product in-memory, FIFO
        const stockEntries = allStockEntries.filter(
          (stock) => stock.productId === item.productId
        );

        for (const stock of stockEntries) {
          if (requiredQty <= 0) break;

          const available = stock.quantity - stock.reservedQty;
          if (available <= 0) continue;

          const qtyToPick = Math.min(requiredQty, available);

          // Update reserved quantity in DB
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: { reservedQty: stock.reservedQty + qtyToPick, isReserved: true },
          });

          // Update in-memory to prevent double-allocating from the same entry
          stock.reservedQty += qtyToPick;

          // Create DOPickingItem
          await tx.dOPickingItem.create({
            data: {
              deliveryOrderId: newDO.id,
              dtItemId: item.id,
              productId: item.productId,
              stockLedgerId: stock.id,
              palletPositionId: stock.palletPositionId,
              positionCode: stock.palletPosition.positionCode,
              batchNumber: stock.batchNumber,
              requiredQty: qtyToPick,
              status: "pending",
            },
          });

          requiredQty -= qtyToPick;
        }

        if (requiredQty > 0) {
          // Log shortage
          console.warn(`Shortage for product ${item.productCode}: ${requiredQty} pcs unfulfilled.`);
        }
      }

      // 5. Update DT status
      await tx.deliveryTicket.update({
        where: { id: ticket.id },
        data: { status: "processing" },
      });

      return newDO;
    },
    {
      maxWait: 10000,
      timeout: 30000,
    });

    return NextResponse.json({ success: true, deliveryOrder }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/delivery-tickets/[id]/create-do error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
