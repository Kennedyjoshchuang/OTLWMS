import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/delivery-tickets/lookup-locations
 * Body: { customerId: string, items: { productCode: string, lotBatchNo?: string }[] }
 * Returns location data per item for the OCR review step (before DT is saved).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, items } = body;

    if (!customerId || !items?.length) {
      return NextResponse.json({ locations: [] });
    }

    const productCodes: string[] = [...new Set<string>(items.map((i: any) => String(i.productCode)))];

    // Find products
    const products = await prisma.product.findMany({
      where: { customerId, productCode: { in: productCodes } },
    });
    const productMap = new Map(products.map((p) => [p.productCode, p.id]));

    const result = await Promise.all(
      items.map(async (item: { productCode: string; lotBatchNo?: string }) => {
        const productId = productMap.get(item.productCode);
        if (!productId) {
          return { productCode: item.productCode, locations: [] };
        }

        const whereClause: any = {
          productId,
          quantity: { gt: 0 },
        };


        const stockEntries = await prisma.stockLedger.findMany({
          where: whereClause,
          orderBy: { inboundDate: "asc" }, // FIFO
          take: 5,
          include: {
            palletPosition: {
              include: { rack: { select: { rackCode: true, rackName: true } } },
            },
          },
        });

        return {
          productCode: item.productCode,
          lotBatchNo: item.lotBatchNo,
          locations: stockEntries.map((s) => ({
            positionCode: s.palletPosition.positionCode,
            rackCode: s.palletPosition.rack.rackCode,
            batchNumber: s.batchNumber,
            availableQty: s.quantity - s.reservedQty,
            inboundDate: s.inboundDate,
          })),
        };
      })
    );

    return NextResponse.json({ locations: result });
  } catch (error: any) {
    console.error("POST /api/delivery-tickets/lookup-locations error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
