import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/pricing/[key] — update a pricing rate
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const { key } = await params;
    const body = await req.json();

    const { label, description, unit, unitPrice, isActive } = body;

    // Validate unitPrice
    if (unitPrice !== undefined && (isNaN(Number(unitPrice)) || Number(unitPrice) < 0)) {
      return NextResponse.json(
        { error: "Unit price must be a non-negative number." },
        { status: 400 }
      );
    }

    const existing = await prisma.pricingRate.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json(
        { error: `Pricing rate with key "${key}" not found.` },
        { status: 404 }
      );
    }

    const updated = await prisma.pricingRate.update({
      where: { key },
      data: {
        ...(label !== undefined && { label }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(unitPrice !== undefined && { unitPrice: Number(unitPrice) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, rate: updated }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /api/pricing/[key] error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
