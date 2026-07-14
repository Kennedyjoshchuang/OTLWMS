import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const type = searchParams.get("type") || "all";
    const search = searchParams.get("search") || "";

    // Build the query where clause
    const where: any = {};

    if (type !== "all") {
      where.movementType = type;
    }

    if (search) {
      where.OR = [
        {
          product: {
            OR: [
              { productCode: { contains: search, mode: "insensitive" } },
              { productName: { contains: search, mode: "insensitive" } },
            ]
          }
        },
        {
          notes: { contains: search, mode: "insensitive" }
        }
      ];
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: true,
          performedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Fetch pallet position details for the unique palletPositionId values
    const positionIds = Array.from(
      new Set(movements.map((m) => m.palletPositionId).filter(Boolean))
    ) as string[];

    let positionMap = new Map();
    if (positionIds.length > 0) {
      const positions = await prisma.palletPosition.findMany({
        where: { id: { in: positionIds } },
        include: { rack: true }
      });
      positionMap = new Map(positions.map((p) => [p.id, p]));
    }

    // Attach position details to movements
    const formattedMovements = movements.map((m) => {
      const pos = m.palletPositionId ? positionMap.get(m.palletPositionId) : null;
      return {
        ...m,
        palletPosition: pos
          ? {
              id: pos.id,
              positionCode: pos.positionCode,
              rackCode: pos.rack.rackCode,
              rackName: pos.rack.rackName,
              rowNumber: pos.rowNumber,
              levelNumber: pos.levelNumber,
              positionNumber: pos.positionNumber,
            }
          : null,
      };
    });

    return NextResponse.json({
      movements: formattedMovements,
      total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/warehouse/movements error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
