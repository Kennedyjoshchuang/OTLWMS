import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const doRecord = await prisma.deliveryOrder.findUnique({ where: { id } });

    if (!doRecord) {
      return NextResponse.json({ error: "Delivery Order not found." }, { status: 404 });
    }

    if (doRecord.status !== "delivered") {
      return NextResponse.json(
        { error: "Delivery Order must be in Picked status before marking as Delivered." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { driverId } = body;

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: {
        status: "on_delivery",
        shippedAt: new Date(),
        ...(driverId ? { driverId } : {}),
      },
    });

    return NextResponse.json({ success: true, deliveryOrder: updated }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/mark-delivered error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
