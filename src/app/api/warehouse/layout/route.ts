import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const racks = await prisma.warehouseRack.findMany({
      include: {
        positions: {
          include: {
            stockLedgers: {
              include: { product: true }
            }
          },
          orderBy: [
            { rowNumber: 'asc' },
            { levelNumber: 'asc' },
            { positionNumber: 'asc' }
          ]
        }
      },
      orderBy: { rackCode: 'asc' }
    });

    return NextResponse.json(racks);
  } catch (error: any) {
    console.error("GET /api/warehouse/layout error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
