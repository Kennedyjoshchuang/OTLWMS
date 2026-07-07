import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: "Invalid data format." }, { status: 400 });
    }

    // Update each position in a transaction
    const updates = positions.map((pos: any) =>
      prisma.palletPosition.update({
        where: { id: pos.id },
        data: { positionCode: pos.positionCode },
      })
    );

    const updated = await prisma.$transaction(updates);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/warehouse/positions error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
