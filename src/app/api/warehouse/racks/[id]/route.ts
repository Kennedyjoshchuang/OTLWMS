import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/warehouse/racks/[id] — update rackName and/or levelAliases
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { rackName, levelAliases } = body;

    if (!rackName || rackName.trim() === "") {
      return NextResponse.json(
        { error: "rackName is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.warehouseRack.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rack not found." }, { status: 404 });
    }

    const updated = await prisma.warehouseRack.update({
      where: { id },
      data: {
        rackName: rackName.trim(),
        levelAliases: levelAliases
          ? JSON.stringify(levelAliases) // store as JSON string
          : null,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/warehouse/racks/[id] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
