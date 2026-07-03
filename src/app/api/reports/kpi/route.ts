import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Build date range filter
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    // ── KPI 1: Zero Incident ──────────────────────────────────────────────────
    const incidentCount = await prisma.incident.count({
      where: {
        reportedAt: { gte: fromDate, lte: toDate },
      },
    });

    const recentIncidents = await prisma.incident.findMany({
      where: { reportedAt: { gte: fromDate, lte: toDate } },
      orderBy: { reportedAt: "desc" },
      take: 5,
      select: { id: true, type: true, description: true, location: true, reportedAt: true },
    });

    // ── KPI 2: On Time Delivery (OTIF) ────────────────────────────────────────
    // Delivered DOs within the date range
    const deliveredOrders = await prisma.deliveryOrder.findMany({
      where: {
        status: "delivered",
        deliveredAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        deliveredAt: true,
        deliveryTicket: { select: { deliveryDate: true } },
      },
    });

    const totalDelivered = deliveredOrders.length;
    const onTimeCount = deliveredOrders.filter((o) => {
      const dueDate = o.deliveryTicket?.deliveryDate;
      if (!dueDate || !o.deliveredAt) return false;
      return new Date(o.deliveredAt) <= new Date(dueDate);
    }).length;

    const otifRate = totalDelivered > 0 ? (onTimeCount / totalDelivered) * 100 : null;

    // ── KPI 3: Delivery Ticket (DT) Return ────────────────────────────────────
    // Delivered DOs with a proof of delivery (POD) uploaded
    const dtDeliveredOrders = await prisma.deliveryOrder.findMany({
      where: {
        status: "delivered",
        deliveredAt: { gte: fromDate, lte: toDate },
      },
      select: {
        id: true,
        proofOfDeliveryUrl: true,
        podPhotoUrl: true,
      },
    });

    const dtTotal = dtDeliveredOrders.length;
    const dtWithPod = dtDeliveredOrders.filter(
      (o) => o.proofOfDeliveryUrl || o.podPhotoUrl
    ).length;

    const dtReturnRate = dtTotal > 0 ? (dtWithPod / dtTotal) * 100 : null;

    // ── Summary ───────────────────────────────────────────────────────────────
    const kpi = {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      zeroIncident: {
        target: 0,
        actual: incidentCount,
        met: incidentCount === 0,
        recentIncidents: recentIncidents.map((i) => ({
          ...i,
          reportedAt: i.reportedAt.toISOString(),
        })),
      },
      otif: {
        target: 97,
        actual: otifRate,
        totalDelivered,
        onTimeCount,
        met: otifRate !== null ? otifRate >= 97 : null,
      },
      dtReturn: {
        target: 100,
        actual: dtReturnRate,
        totalDelivered: dtTotal,
        withPod: dtWithPod,
        met: dtReturnRate !== null ? dtReturnRate >= 100 : null,
      },
    };

    return NextResponse.json({ success: true, kpi });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
