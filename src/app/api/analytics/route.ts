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

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily"; // daily | weekly | monthly | yearly

    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === "daily") {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (period === "weekly") {
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
    } else if (period === "monthly") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (period === "yearly") {
      startDate = startOfYear(now);
      endDate = endOfYear(now);
    } else if (period === "custom") {
      const startParam = searchParams.get("start");
      const endParam = searchParams.get("end");
      if (!startParam || !endParam) return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
      startDate = startOfDay(parseISO(startParam));
      endDate = endOfDay(parseISO(endParam));
    } else {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    // 1. Fetch Inbound (GRN) within period
    const inbounds = await prisma.inboundReceipt.findMany({
      where: { receivedDate: { gte: startDate, lte: endDate } },
      include: {
        stockLedgers: { include: { product: true } }
      }
    });

    // 2. Fetch Outbound (DO) within period based on creation or delivery
    const outbounds = await prisma.deliveryOrder.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: { 
        customer: true, 
        deliveryTicket: {
          include: { items: { include: { product: true } } }
        }
      }
    });

    // Delivered outbounds (shipped or delivered status within period)
    const deliveredDOs = outbounds.filter(o => 
      o.status === "delivered" || o.status === "on_delivery"
    );

    // 3. Pending Deliveries
    const pendingDOs = await prisma.deliveryOrder.findMany({
      where: { status: { in: ["draft", "picking", "ready_to_ship", "on_delivery"] } },
      include: { customer: true, deliveryTicket: true }
    });
    const pendingDeliveriesCount = pendingDOs.length;

    // 4. Warehouse Stock Snapshot (Liters)
    const stockLedgers = await prisma.stockLedger.findMany({
      where: { quantity: { gt: 0 } },
      include: { 
        product: true,
        palletPosition: {
          include: { rack: true }
        }
      }
    });
    const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantityLiter || 0), 0);

    // Unique customers delivered to in this period
    const uniqueCustomers = new Set(deliveredDOs.map(o => o.customerId));

    // 4. Accidents within period
    const incidentsCount = await prisma.incident.count({
      where: { reportedAt: { gte: startDate, lte: endDate } }
    });

    // Generate Chart Data
    let intervals: Date[] = [];
    let customGroupMode = "day"; // used if period === "custom"

    if (period === "custom") {
      const diff = differenceInDays(endDate, startDate);
      if (diff <= 31) {
        customGroupMode = "day";
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
      } else {
        customGroupMode = "month";
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
      }
    } else if (period === "daily") {
      intervals = eachHourOfInterval({ start: startDate, end: endDate });
    } else if (period === "weekly") {
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
    } else if (period === "monthly") {
      intervals = eachDayOfInterval({ start: startDate, end: endDate });
    } else if (period === "yearly") {
      intervals = eachMonthOfInterval({ start: startDate, end: endDate });
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
        inboundLiters = inbounds.filter(i => isSameHour(new Date(i.receivedDate), intervalDate)).reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);
        outboundLiters = outbounds.filter(o => isSameHour(new Date(o.createdAt), intervalDate)).reduce((sum, o) => sum + (o.deliveryTicket?.totalLiter || 0), 0);
      } else if (period === "weekly" || period === "monthly" || (period === "custom" && customGroupMode === "day")) {
        inboundLiters = inbounds.filter(i => isSameDay(new Date(i.receivedDate), intervalDate)).reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);
        outboundLiters = outbounds.filter(o => isSameDay(new Date(o.createdAt), intervalDate)).reduce((sum, o) => sum + (o.deliveryTicket?.totalLiter || 0), 0);
      } else if (period === "yearly" || (period === "custom" && customGroupMode === "month")) {
        inboundLiters = inbounds.filter(i => isSameMonth(new Date(i.receivedDate), intervalDate)).reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);
        outboundLiters = outbounds.filter(o => isSameMonth(new Date(o.createdAt), intervalDate)).reduce((sum, o) => sum + (o.deliveryTicket?.totalLiter || 0), 0);
      }

      return {
        name: label,
        Inbound: inboundLiters,
        Outbound: outboundLiters
      };
    });

    // Summary Totals
    const totalInboundLiters = inbounds.reduce((sum, i) => sum + (i.totalLiterReceived || 0), 0);
    const totalOutboundLiters = outbounds.reduce((sum, o) => sum + (o.deliveryTicket?.totalLiter || 0), 0);

    // --- Detailed Reporting ---
    
    // Inbound details (grouped by product)
    const inboundProductMap = new Map<string, { productCode: string, productName: string, pcs: number, liter: number }>();
    inbounds.forEach(receipt => {
      receipt.stockLedgers.forEach(sl => {
        const p = sl.product;
        const key = p.id;
        if (!inboundProductMap.has(key)) {
          inboundProductMap.set(key, { productCode: p.productCode, productName: p.productName, pcs: 0, liter: 0 });
        }
        const current = inboundProductMap.get(key)!;
        current.pcs += sl.quantity;
        current.liter += (sl.quantityLiter || 0);
      });
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
          current.pcs += item.delQtyPcs;
          current.liter += (item.delQtyLiter || 0);
        }
      });
    });
    const outboundProductDetails = Array.from(outboundProductMap.values()).sort((a, b) => b.liter - a.liter);

    // Delivered Outbound Details (By Order)
    const outboundDetails = deliveredDOs.map(doItem => ({
      id: doItem.id,
      doNumber: doItem.doNumber,
      customerName: doItem.customer.name,
      destination: doItem.deliveryTicket?.deliverToAddress || doItem.destination,
      deliveryDate: doItem.deliveryDate || doItem.createdAt,
      totalPcs: doItem.deliveryTicket?.totalPcs || 0,
      totalLiter: doItem.deliveryTicket?.totalLiter || 0
    })).sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());

    // Pending Deliveries Details
    const pendingDetails = pendingDOs.map(doItem => ({
      id: doItem.id,
      doNumber: doItem.doNumber,
      customerName: doItem.customer.name,
      destination: doItem.deliveryTicket?.deliverToAddress || doItem.destination,
      status: doItem.status,
      createdAt: doItem.createdAt,
      totalPcs: doItem.deliveryTicket?.totalPcs || 0,
      totalLiter: doItem.deliveryTicket?.totalLiter || 0
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Detailed Stock Report
    const stockMap = new Map<string, { productCode: string, productName: string, location: string, pcs: number, liter: number }>();
    stockLedgers.forEach(sl => {
      const p = sl.product;
      const pos = sl.palletPosition;
      const rack = pos.rack;
      const locStr = `Rack ${rack.rackName} - Tier ${pos.levelNumber}`;
      
      const key = `${p.id}-${pos.id}`;
      if (!stockMap.has(key)) {
        stockMap.set(key, { productCode: p.productCode, productName: p.productName, location: locStr, pcs: 0, liter: 0 });
      }
      const current = stockMap.get(key)!;
      current.pcs += sl.quantity;
      current.liter += (sl.quantityLiter || 0);
    });
    const stockDetails = Array.from(stockMap.values()).sort((a, b) => b.liter - a.liter);

    return NextResponse.json({
      success: true,
      summary: {
        inbound: totalInboundLiters,
        outbound: totalOutboundLiters,
        warehouseStock: totalWarehouseStock,
        deliveredCustomers: uniqueCustomers.size,
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
