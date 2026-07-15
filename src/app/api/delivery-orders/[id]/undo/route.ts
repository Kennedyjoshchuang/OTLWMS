import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the DO
    const DO = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { pickingItems: true },
    });

    if (!DO) {
      return NextResponse.json({ error: "Delivery Order not found" }, { status: 404 });
    }

    if (DO.status === "draft") {
      return NextResponse.json({ error: "Delivery Order is already a draft" }, { status: 400 });
    }

    // Check if there are any picking items that have been shipped
    const shippedItems = DO.pickingItems.filter(item => item.status === "shipped");
    if (shippedItems.length > 0) {
      return NextResponse.json(
        { error: "Cannot undo Delivery Order. Some items have already been picked. Please Unpick them manually or use Delete Request." },
        { status: 400 }
      );
    }

    const pendingItems = DO.pickingItems.filter(item => item.status === "pending");

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Decrement reservedQty for pending items
      for (const pi of pendingItems) {
        const stock = await tx.stockLedger.findUnique({
          where: { id: pi.stockLedgerId }
        });
        if (stock) {
          const newReservedQty = Math.max(0, stock.reservedQty - pi.requiredQty);
          await tx.stockLedger.update({
            where: { id: stock.id },
            data: {
              reservedQty: newReservedQty,
              isReserved: newReservedQty > 0
            }
          });
        }
      }

      // 2. Delete any pending picking items just in case
      await tx.dOPickingItem.deleteMany({
        where: { deliveryOrderId: id, status: "pending" }
      });

      // 3. Update status to draft
      return await tx.deliveryOrder.update({
        where: { id },
        data: { status: "draft" },
      });
    });

    return NextResponse.json({ success: true, order: updated });
  } catch (error: any) {
    console.error("POST /api/delivery-orders/[id]/undo error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
