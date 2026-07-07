import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// GET /api/products — list products (optional ?customerId= & ?search=)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId") || undefined;
    const search = searchParams.get("search") || "";

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        ...(customerId ? { customerId } : {}),
        ...(search
          ? {
              OR: [
                { productCode: { contains: search } },
                { productName: { contains: search } },
                { barcode: { contains: search } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { id: true, name: true, code: true } } },
      orderBy: [{ customerId: "asc" }, { productCode: "asc" }],
    });

    return NextResponse.json(products);
  } catch (error: any) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// POST /api/products — create a new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerId,
      productCode,
      productName,
      paintType,
      colorName,
      colorCode,
      sizeLiter,
      weightKg,
      barcode,
      unit,
    } = body;

    if (!customerId || !productCode || !productName) {
      return NextResponse.json(
        { error: "customerId, productCode, and productName are required." },
        { status: 400 }
      );
    }

    // Check duplicate code within customer
    const existing = await prisma.product.findUnique({
      where: { customerId_productCode: { customerId, productCode } },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Product code "${productCode}" already exists for this customer.` },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
      data: {
        customerId,
        productCode: productCode.trim().toUpperCase(),
        productName: productName.trim(),
        paintType: paintType?.trim() || null,
        colorName: colorName?.trim() || null,
        colorCode: colorCode?.trim() || null,
        sizeLiter: sizeLiter ? Number(sizeLiter) : null,
        weightKg: weightKg ? Number(weightKg) : null,
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "pcs",
        isActive: true,
      },
      include: { customer: { select: { id: true, name: true, code: true } } },
    });

    // Invalidate next.js client-side router cache for the dashboard
    revalidatePath("/dashboard", "layout");

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
