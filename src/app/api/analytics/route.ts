import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear,
  eachHourOfInterval, eachDayOfInterval, eachMonthOfInterval,
  format, isSameHour, isSameDay, isSameMonth, differenceInDays, parseISO
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getDisplayRowNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily"; // daily | weekly | monthly | yearly

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
    } else if (period === "custom") {
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (!startParam || !endParam) return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
      tzStartDate = startOfDay(toZonedTime(new Date(startParam + "T00:00:00Z"), TIME_ZONE));
      tzEndDate = endOfDay(toZonedTime(new Date(endParam + "T12:00:00Z"), TIME_ZONE));
    } else {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
    const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

    // Fetch active references to filter out orphaned movements
    const [activeDOs, activeReceipts] = await Promise.all([
      prisma.deliveryOrder.findMany({ select: { id: true } }),
      prisma.inboundReceipt.findMany({ select: { id: true } })
    ]);
    const activeDOIds = new Set(activeDOs.map(d => d.id));
    const activeReceiptIds = new Set(activeReceipts.map(r => r.id));

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

    // 1. Fetch Inbound (GRN) within period
    const inbounds = await prisma.inboundReceipt.findMany({
      where: { createdAt: { gte: prismaStartDate, lte: prismaEndDate } }
    });

    // Fetch Inbound Stock Movements within period
    const inboundMovementsDb = await prisma.stockMovement.findMany({
      where: {
        movementType: "inbound",
        referenceType: "inbound_receipt",
        createdAt: { gte: prismaStartDate, lte: prismaEndDate }
      },
      include: {
        product: true
      }
    });
    const inboundMovements = inboundMovementsDb.filter(isMovementValid);

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

    // Outbound DOs (include both Picked/shipped/delivered statuses)
    const deliveredDOs = outbounds.filter(o => {
      const isOutboundStatus = ["delivered", "on_delivery", "partially_delivered"].includes(o.status);
      if (!isOutboundStatus) return false;
      const relevantDate = getDORelevantDate(o);
      return relevantDate >= prismaStartDate && relevantDate <= prismaEndDate;
    });

    // 3. Pending Deliveries (status "delivered" represents Picked - Ready to Deliver)
    const pendingDOs = await prisma.deliveryOrder.findMany({
      where: { 
        status: "delivered",
        createdAt: { gte: prismaStartDate, lte: prismaEndDate }
      },
      include: { 
        customer: true, 
        deliveryTicket: {
          include: { items: { include: { product: true } } }
        }
      }
    });
    const pendingDeliveriesCount = pendingDOs.length;

    // 4. Warehouse Stock Snapshot (Liters)
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
    const validStockLedgersDb = stockLedgersDb.filter(sl => !sl.inboundReceiptId || activeReceiptIds.has(sl.inboundReceiptId));

    const movementsAfterDb = await prisma.stockMovement.findMany({
      where: {
        createdAt: { gt: prismaEndDate },
        movementType: { in: ["inbound", "outbound", "adjustment"] }
      }
    });
    const movementsAfter = movementsAfterDb.filter(isMovementValid);

    // Group current stock ledgers by product, position, and batch
    const ledgerGroups = new Map<string, typeof validStockLedgersDb>();
    for (const sl of validStockLedgersDb) {
      const key = `${sl.productId}-${sl.palletPositionId || ""}-${sl.batchNumber || ""}`;
      const group = ledgerGroups.get(key) || [];
      group.push(sl);
      ledgerGroups.set(key, group);
    }

    const movementMap = new Map<string, number>();
    for (const m of movementsAfter) {
      const key = `${m.productId}-${m.palletPositionId || ""}-${m.batchNumber || ""}`;
      let delta = 0;
      if (m.movementType === "inbound") {
        delta = m.quantity;
      } else if (m.movementType === "outbound" || m.movementType === "adjustment") {
        delta = -m.quantity;
      }
      movementMap.set(key, (movementMap.get(key) || 0) + delta);
    }

    const stockLedgers: typeof validStockLedgersDb = [];
    for (const [key, group] of ledgerGroups.entries()) {
      const totalCurrentQty = group.reduce((sum, sl) => sum + sl.quantity, 0);
      const netChangeAfter = movementMap.get(key) || 0;
      const reconstructedQty = totalCurrentQty - netChangeAfter;

      if (reconstructedQty > 0) {
        const delta = reconstructedQty - totalCurrentQty;
        
        // Add first ledger with the delta
        stockLedgers.push({
          ...group[0],
          quantity: group[0].quantity + delta,
          quantityLiter: (group[0].quantity + delta) * (group[0].product?.sizeLiter || 0)
        });

        // Add remaining ledgers in the group unchanged
        for (let i = 1; i < group.length; i++) {
          stockLedgers.push({
            ...group[i],
            quantity: group[i].quantity,
            quantityLiter: group[i].quantity * (group[i].product?.sizeLiter || 0)
          });
        }
      }
    }

    const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);

    const calcOutboundLiter = (o: any) => o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.deliveredQty * (it.product?.sizeLiter || 0)), 0) || 0;

    // Unique customers delivered to in this period
    const uniqueCustomers = new Set(deliveredDOs.map(o => o.customerId));

    // 4. Accidents within period
    const incidentsCount = await prisma.incident.count({
      where: { reportedAt: { gte: prismaStartDate, lte: prismaEndDate } }
    });

    // Generate Chart Data
    let intervals: Date[] = [];
    let customGroupMode = "day"; // used if period === "custom"

    if (period === "custom") {
      const diff = differenceInDays(tzEndDate, tzStartDate);
      if (diff <= 31) {
        customGroupMode = "day";
        intervals = eachDayOfInterval({ start: tzStartDate, end: tzEndDate });
      } else {
        customGroupMode = "month";
        intervals = eachMonthOfInterval({ start: tzStartDate, end: tzEndDate });
      }
    } else if (period === "daily") {
      intervals = eachHourOfInterval({ start: tzStartDate, end: tzEndDate });
    } else if (period === "weekly") {
      intervals = eachDayOfInterval({ start: tzStartDate, end: tzEndDate });
    } else if (period === "monthly") {
      intervals = eachDayOfInterval({ start: tzStartDate, end: tzEndDate });
    } else if (period === "yearly") {
      intervals = eachMonthOfInterval({ start: tzStartDate, end: tzEndDate });
    }

    const chartData = intervals.map(intervalDate => {
      let label = "";
      if (period === "daily") label = format(intervalDate, "HH:mm");
      else if (period === "weekly") label = format(intervalDate, "EEE");
      else if (period === "monthly") label = format(intervalDate, "dd MMM");
      else if (period === "yearly") label = format(intervalDate, "MMM yyyy");
      else if (period === "custom") {
        label = customGroupMode === "day" ? format(intervalDate, "dd MMM") : format(intervalDate, "MMM yyyy");
      }

      // Sum liters for this interval
      let inboundLiters = 0;
      let outboundLiters = 0;

      if (period === "daily") {
        inboundLiters = inboundMovements.filter(m => isSameHour(toZonedTime(new Date(m.createdAt), TIME_ZONE), intervalDate)).reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
        outboundLiters = deliveredDOs.filter(o => isSameHour(toZonedTime(getDORelevantDate(o), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      } else if (period === "weekly" || period === "monthly" || (period === "custom" && customGroupMode === "day")) {
        inboundLiters = inboundMovements.filter(m => isSameDay(toZonedTime(new Date(m.createdAt), TIME_ZONE), intervalDate)).reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
        outboundLiters = deliveredDOs.filter(o => isSameDay(toZonedTime(getDORelevantDate(o), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      } else if (period === "yearly" || (period === "custom" && customGroupMode === "month")) {
        inboundLiters = inboundMovements.filter(m => isSameMonth(toZonedTime(new Date(m.createdAt), TIME_ZONE), intervalDate)).reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
        outboundLiters = deliveredDOs.filter(o => isSameMonth(toZonedTime(getDORelevantDate(o), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      }

      return {
        name: label,
        Inbound: inboundLiters,
        Outbound: outboundLiters
      };
    });

    // Summary Totals
    const totalInboundLiters = inboundMovements.reduce((sum, m) => sum + (m.quantity * (m.product?.sizeLiter || 0)), 0);
    const totalOutboundLiters = deliveredDOs.reduce((sum, o) => sum + calcOutboundLiter(o), 0);

    // --- Detailed Reporting ---

    // Inbound details (grouped by product)
    const inboundProductMap = new Map<string, { productCode: string, productName: string, pcs: number, liter: number }>();
    inboundMovements.forEach(m => {
      const p = m.product;
      if (p) {
        const key = p.id;
        if (!inboundProductMap.has(key)) {
          inboundProductMap.set(key, { productCode: p.productCode, productName: p.productName, pcs: 0, liter: 0 });
        }
        const current = inboundProductMap.get(key)!;
        current.pcs += m.quantity;
        current.liter += (m.quantity * (p.sizeLiter || 0));
      }
    });
    const inboundDetails = Array.from(inboundProductMap.values()).sort((a, b) => b.liter - a.liter);

    // Outbound product details (grouped by product)
    const outboundProductMap = new Map<string, { productCode: string, productName: string, pcs: number, liter: number }>();
    deliveredDOs.forEach(doItem => {
      doItem.deliveryTicket?.items.forEach(item => {
        const p = item.product;
        if (p) {
          const key = p.id;
          if (!outboundProductMap.has(key)) {
            outboundProductMap.set(key, { productCode: p.productCode, productName: p.productName, pcs: 0, liter: 0 });
          }
          const current = outboundProductMap.get(key)!;
          current.pcs += item.deliveredQty;
          current.liter += (item.deliveredQty * (p.sizeLiter || 0));
        }
      });
    });
    const outboundProductDetails = Array.from(outboundProductMap.values()).filter(item => item.pcs > 0).sort((a, b) => b.liter - a.liter);

    // Delivered Outbound Details (By Order)
    const outboundDetails = deliveredDOs.map(doItem => ({
      id: doItem.id,
      doNumber: doItem.doNumber,
      customerName: doItem.customer.name,
      destination: doItem.deliveryTicket?.deliverToAddress || doItem.destination,
      deliveryDate: doItem.deliveryDate || doItem.createdAt,
      totalPcs: doItem.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + it.deliveredQty, 0) || 0,
      totalLiter: calcOutboundLiter(doItem)
    })).sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());

    // Pending Deliveries Details
    const pendingDetails = pendingDOs.map(doItem => ({
      id: doItem.id,
      doNumber: doItem.doNumber,
      customerName: doItem.customer.name,
      destination: doItem.deliveryTicket?.deliverToAddress || doItem.destination,
      status: doItem.status,
      createdAt: doItem.createdAt,
      totalPcs: doItem.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + it.deliveredQty, 0) || 0,
      totalLiter: calcOutboundLiter(doItem)
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Detailed Stock Report
    const stockMap = new Map<string, { productCode: string, productName: string, location: string, pcs: number, liter: number }>();
    stockLedgers.forEach(sl => {
      const p = sl.product;
      const pos = sl.palletPosition;
      const rack = pos.rack;
      
      const rackName = rack.rackCode === 'FLOOR' ? 'Floor' : rack.rackCode;
      const displayRow = getDisplayRowNumber(rack.rackCode, pos.rowNumber);
      const rowName = String(displayRow).padStart(2, '0');
      const levelName = String(pos.levelNumber).padStart(2, '0');
      const tierName = `Tier ${rack.rackCode}-${rowName}${levelName}`;
      const locStr = `${rackName}${rowName} - ${tierName}`;
      
      const key = `${p.id}-${pos.id}`;
      if (!stockMap.has(key)) {
        stockMap.set(key, { productCode: p.productCode, productName: p.productName, location: locStr, pcs: 0, liter: 0 });
      }
      const current = stockMap.get(key)!;
      current.pcs += sl.quantity;
      current.liter += (sl.quantity * (p.sizeLiter || 0));
    });
    const stockDetails = Array.from(stockMap.values()).sort((a, b) => b.liter - a.liter);

    return NextResponse.json({
      success: true,
      summary: {
        inbound: totalInboundLiters,
        outbound: totalOutboundLiters,
        warehouseStock: totalWarehouseStock,
        deliveredOrders: deliveredDOs.length,
        pendingDeliveries: pendingDeliveriesCount,
        accidents: incidentsCount
      },
      chartData,
      details: {
        inbound: inboundDetails,
        outboundProducts: outboundProductDetails,
        outbound: outboundDetails,
        pending: pendingDetails,
        stock: stockDetails
      }
    });
  } catch (error: any) {
    console.error("Analytics API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
