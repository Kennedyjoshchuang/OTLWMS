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
      tzStartDate = startOfDay(parseISO(startParam));
      tzEndDate = endOfDay(parseISO(endParam));
    } else {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const prismaStartDate = fromZonedTime(tzStartDate, TIME_ZONE);
    const prismaEndDate = fromZonedTime(tzEndDate, TIME_ZONE);

    // 1. Fetch Inbound (GRN) within period
    const inbounds = await prisma.inboundReceipt.findMany({
      where: { createdAt: { gte: prismaStartDate, lte: prismaEndDate } },
      include: {
        stockLedgers: { include: { product: true } }
      }
    });

    // 2. Fetch Outbound (DO) within period based on creation or delivery
    const outbounds = await prisma.deliveryOrder.findMany({
      where: { createdAt: { gte: prismaStartDate, lte: prismaEndDate } },
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
      include: { 
        customer: true, 
        deliveryTicket: {
          include: { items: { include: { product: true } } }
        }
      }
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
    const totalWarehouseStock = stockLedgers.reduce((sum, sl) => sum + (sl.quantity * (sl.product?.sizeLiter || 0)), 0);

    const calcInboundLiter = (i: any) => i.stockLedgers?.reduce((acc: number, sl: any) => acc + (sl.quantity * (sl.product?.sizeLiter || 0)), 0) || 0;
    const calcOutboundLiter = (o: any) => o.deliveryTicket?.items?.reduce((acc: number, it: any) => acc + (it.delQtyPcs * (it.product?.sizeLiter || 0)), 0) || 0;

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
        inboundLiters = inbounds.filter(i => isSameHour(toZonedTime(new Date(i.createdAt), TIME_ZONE), intervalDate)).reduce((sum, i) => sum + calcInboundLiter(i), 0);
        outboundLiters = outbounds.filter(o => isSameHour(toZonedTime(new Date(o.createdAt), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      } else if (period === "weekly" || period === "monthly" || (period === "custom" && customGroupMode === "day")) {
        inboundLiters = inbounds.filter(i => isSameDay(toZonedTime(new Date(i.createdAt), TIME_ZONE), intervalDate)).reduce((sum, i) => sum + calcInboundLiter(i), 0);
        outboundLiters = outbounds.filter(o => isSameDay(toZonedTime(new Date(o.createdAt), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      } else if (period === "yearly" || (period === "custom" && customGroupMode === "month")) {
        inboundLiters = inbounds.filter(i => isSameMonth(toZonedTime(new Date(i.createdAt), TIME_ZONE), intervalDate)).reduce((sum, i) => sum + calcInboundLiter(i), 0);
        outboundLiters = outbounds.filter(o => isSameMonth(toZonedTime(new Date(o.createdAt), TIME_ZONE), intervalDate)).reduce((sum, o) => sum + calcOutboundLiter(o), 0);
      }

      return {
        name: label,
        Inbound: inboundLiters,
        Outbound: outboundLiters
      };
    });

    // Summary Totals
    const totalInboundLiters = inbounds.reduce((sum, i) => sum + calcInboundLiter(i), 0);
    const totalOutboundLiters = outbounds.reduce((sum, o) => sum + calcOutboundLiter(o), 0);

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
        current.liter += (sl.quantity * (p.sizeLiter || 0));
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
          current.liter += (item.delQtyPcs * (p.sizeLiter || 0));
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
      totalPcs: doItem.deliveryTicket?.totalPcs || 0,
      totalLiter: calcOutboundLiter(doItem)
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Detailed Stock Report
    const stockMap = new Map<string, { productCode: string, productName: string, location: string, pcs: number, liter: number }>();
    stockLedgers.forEach(sl => {
      const p = sl.product;
      const pos = sl.palletPosition;
      const rack = pos.rack;
      
      const rackName = rack.rackCode === 'FLOOR' ? 'Floor' : rack.rackCode;
      const rowName = String(pos.rowNumber).padStart(2, '0');
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
