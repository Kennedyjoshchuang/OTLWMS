import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { positions } = body;

    if (!Array.isArray(positions)) {
      return NextResponse.json({ error: "Invalid data format." }, { status: 400 });
    }

    // Step 1: Update each position to a temporary code to avoid unique constraint violations during swapping
    const tempUpdates = positions.map((pos: any) =>
      prisma.palletPosition.update({
        where: { id: pos.id },
        data: { positionCode: `temp_${pos.id}_${Date.now()}` },
      })
    );
    await prisma.$transaction(tempUpdates);

    // Step 2: Update to the actual desired position codes
    const finalUpdates = positions.map((pos: any) =>
      prisma.palletPosition.update({
        where: { id: pos.id },
        data: { positionCode: pos.positionCode },
      })
    );
    const updated = await prisma.$transaction(finalUpdates);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/warehouse/positions error:", error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "Nama posisi ini sudah digunakan di rak atau baris lain. Harap gunakan nama (Position Code) yang unik." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
