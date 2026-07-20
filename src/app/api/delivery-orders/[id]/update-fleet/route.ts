import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { driverId, vehicleNo, helperName } = body;

    const existing = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Delivery Order not found." }, { status: 404 });
    }

    const dataToUpdate: any = {};
    if (driverId !== undefined) {
      dataToUpdate.driverId = driverId || null;
    }
    if (vehicleNo !== undefined) {
      dataToUpdate.vehicleNo = vehicleNo ? vehicleNo.trim() : null;
    }
    if (helperName !== undefined) {
      dataToUpdate.helperName = helperName ? helperName.trim() : null;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: dataToUpdate,
      include: {
        customer: true,
        driver: true,
        picker: true,
        deliveryTicket: {
          select: {
            dtNumber: true,
            deliverToName: true,
            deliverToAddress: true,
          },
        },
        pickingItems: { select: { id: true } },
      },
    });

    return NextResponse.json({ success: true, order: updated }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/delivery-orders/[id]/update-fleet error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
