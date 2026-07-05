import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/pricing — fetch all pricing rates
export async function GET() {
  try {
    const rates = await prisma.pricingRate.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ rates }, { status: 200 });
  } catch (error: any) {
    console.error("GET /api/pricing error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
