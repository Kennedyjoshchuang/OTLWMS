import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/delete-requests — list all (super_admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any)?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    const requests = await (prisma as any).deleteRequest.findMany({
      where: status ? { status } : {},
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (error: any) {
    console.error("GET /api/delete-requests error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/delete-requests — submit a deletion request (any authenticated user)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any)?.id;
    if (!userId) return NextResponse.json({ error: "User ID not found in session" }, { status: 400 });

    const body = await req.json();
    const { targetModel, targetId, targetLabel, reason } = body;

    if (!targetModel || !targetId || !targetLabel) {
      return NextResponse.json(
        { error: "targetModel, targetId, and targetLabel are required." },
        { status: 400 }
      );
    }

    const validModels = ["InboundReceipt", "Product", "Invoice", "Customer", "DeliveryTicket", "DeliveryOrder", "PackingList", "User"];
    if (!validModels.includes(targetModel)) {
      return NextResponse.json({ error: `Invalid targetModel: ${targetModel}` }, { status: 400 });
    }

    // Check if a pending request already exists for this item
    const existing = await (prisma as any).deleteRequest.findFirst({
      where: { targetModel, targetId, status: "pending" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A deletion request for this item is already pending." },
        { status: 409 }
      );
    }

    const request = await (prisma as any).deleteRequest.create({
      data: {
        targetModel,
        targetId,
        targetLabel,
        reason: reason?.trim() || null,
        requestedById: userId,
        status: "pending",
      },
      include: {
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/delete-requests error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
