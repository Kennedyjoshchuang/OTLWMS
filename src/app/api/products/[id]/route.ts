import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/products/[id] — update product fields
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      productCode,
      productName,
      paintType,
      colorName,
      colorCode,
      sizeLiter,
      weightKg,
      barcode,
      unit,
      isActive,
    } = body;

    if (!productCode || !productName) {
      return NextResponse.json(
        { error: "productCode and productName are required." },
        { status: 400 }
      );
    }

    // Check duplicate code within same customer (exclude self)
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const conflict = await prisma.product.findFirst({
      where: {
        customerId: current.customerId,
        productCode: productCode.trim().toUpperCase(),
        NOT: { id },
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `Product code "${productCode}" already exists for this customer.` },
        { status: 409 }
      );
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        productCode: productCode.trim().toUpperCase(),
        productName: productName.trim(),
        paintType: paintType?.trim() || null,
        colorName: colorName?.trim() || null,
        colorCode: colorCode?.trim() || null,
        sizeLiter: sizeLiter !== undefined && sizeLiter !== "" ? Number(sizeLiter) : null,
        weightKg: weightKg !== undefined && weightKg !== "" ? Number(weightKg) : null,
        barcode: barcode?.trim() || null,
        unit: unit?.trim() || "pcs",
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
      include: { customer: { select: { id: true, name: true, code: true } } },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/products/[id] — soft-delete (set isActive = false)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
