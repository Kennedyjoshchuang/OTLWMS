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

    // Fetch the ticket
    const ticket = await prisma.deliveryTicket.findUnique({
      where: { id },
      include: { deliveryOrders: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Delivery Ticket not found" }, { status: 404 });
    }

    if (ticket.status === "draft") {
      return NextResponse.json({ error: "Ticket is already a draft" }, { status: 400 });
    }

    // Check if there are active DOs
    if (ticket.deliveryOrders && ticket.deliveryOrders.length > 0) {
      return NextResponse.json(
        { error: "Cannot undo Delivery Ticket. Active Delivery Orders exist. Undo or delete them first." },
        { status: 400 }
      );
    }

    // Update status to draft
    const updated = await prisma.deliveryTicket.update({
      where: { id },
      data: { status: "draft" },
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (error: any) {
    console.error("POST /api/delivery-tickets/[id]/undo error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
