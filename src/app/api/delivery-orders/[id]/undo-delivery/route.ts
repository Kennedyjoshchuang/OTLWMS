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

    if (doRecord.status !== "on_delivery") {
      return NextResponse.json(
        { error: "Delivery Order must be in Delivered (on_delivery) status to undo." },
        { status: 400 }
      );
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: {
        status: "delivered", // Reverts status back to Picked
        shippedAt: null,     // Clears shipped time
      },
    });

    return NextResponse.json({ success: true, deliveryOrder: updated }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/undo-delivery error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
