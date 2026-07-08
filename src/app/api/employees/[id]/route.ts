import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserRole = (session.user as any)?.role;
    if (currentUserRole !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden — only super_admin can edit employee accounts." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { fullName, phone, role, allowedPages, readWritePages } = body;

    if (!fullName || !role) {
      return NextResponse.json(
        { error: "fullName and role are required." },
        { status: 400 }
      );
    }

    const validRoles = [
      "super_admin",
      "warehouse_admin",
      "checker_inbound",
      "picker",
      "driver",
      "customer_viewer",
      "inbound_staff",
      "outbound_staff",
      "picklist_staff",
      "delivery_staff",
      "hr_staff",
      "product_staff",
      "billing_staff",
      "report_staff",
      "warehouse_staff",
      "analytics",
    ];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        fullName,
        phone: phone || null,
        role,
        allowedPages: allowedPages || [],
        readWritePages: readWritePages || [],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        allowedPages: true,
        readWritePages: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (err: any) {
    console.error("[PATCH /api/employees/[id]]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error." },
      { status: 500 }
    );
  }
}
