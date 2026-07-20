import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { roundFloat } from "@/lib/utils";

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
      confirmReactivate,
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

    const normalizedProductCode = productCode.trim().toUpperCase();

    const conflict = await prisma.product.findFirst({
      where: {
        customerId: current.customerId,
        productCode: normalizedProductCode,
        NOT: { id },
      },
    });

    if (conflict) {
      if (conflict.isActive) {
        return NextResponse.json(
          { error: `Product code "${normalizedProductCode}" already exists for this customer.` },
          { status: 409 }
        );
      }

      // Product exists but is inactive
      if (confirmReactivate === true) {
        const updated = await prisma.$transaction(async (tx) => {
          // 1. Rename conflict code to avoid unique constraint
          const tempCode = `${conflict.productCode}_DELETED_${Date.now()}`;
          await tx.product.update({
            where: { id: conflict.id },
            data: { productCode: tempCode },
          });

          // 2. Update the product itself
          const prod = await tx.product.update({
            where: { id },
            data: {
              productCode: normalizedProductCode,
              productName: productName.trim(),
              paintType: paintType?.trim() || null,
              colorName: colorName?.trim() || null,
              colorCode: colorCode?.trim() || null,
              sizeLiter: sizeLiter !== undefined && sizeLiter !== "" && sizeLiter !== null ? roundFloat(Number(sizeLiter), 2) : null,
              weightKg: weightKg !== undefined && weightKg !== "" && weightKg !== null ? roundFloat(Number(weightKg), 2) : null,
              barcode: barcode?.trim() || null,
              unit: unit?.trim() || "pcs",
              isActive: true, // Reactivate
            },
            include: { customer: { select: { id: true, name: true, code: true } } },
          });

          // 3. Move relationships from conflict (inactive) to prod (active)
          await tx.packingListItem.updateMany({
            where: { productId: conflict.id },
            data: {
              productId: id,
              productCode: prod.productCode,
              productName: prod.productName,
            },
          });

          await tx.deliveryTicketItem.updateMany({
            where: { productId: conflict.id },
            data: {
              productId: id,
              productCode: prod.productCode,
              productName: prod.productName,
            },
          });

          await tx.stockLedger.updateMany({
            where: { productId: conflict.id },
            data: { productId: id },
          });

          await tx.stockMovement.updateMany({
            where: { productId: conflict.id },
            data: { productId: id },
          });

          await tx.dOPickingItem.updateMany({
            where: { productId: conflict.id },
            data: { productId: id },
          });

          // 4. Sync prod's own related items (just like standard edit)
          await tx.packingListItem.updateMany({
            where: { productId: id },
            data: {
              productCode: prod.productCode,
              productName: prod.productName,
            },
          });

          await tx.deliveryTicketItem.updateMany({
            where: { productId: id },
            data: {
              productCode: prod.productCode,
              productName: prod.productName,
            },
          });

          return prod;
        });

        // Invalidate next.js client-side router cache for the dashboard
        revalidatePath("/dashboard", "layout");

        return NextResponse.json(updated);
      }

      return NextResponse.json(
        {
          error: "SOFT_DELETED_EXISTS",
          message: `Product code "${normalizedProductCode}" already exists for this customer but is inactive. Do you want to restore and update it?`,
        },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update the product itself
      const prod = await tx.product.update({
        where: { id },
        data: {
          productCode: normalizedProductCode,
          productName: productName.trim(),
          paintType: paintType?.trim() || null,
          colorName: colorName?.trim() || null,
          colorCode: colorCode?.trim() || null,
          sizeLiter: sizeLiter !== undefined && sizeLiter !== "" && sizeLiter !== null ? roundFloat(Number(sizeLiter), 2) : null,
          weightKg: weightKg !== undefined && weightKg !== "" && weightKg !== null ? roundFloat(Number(weightKg), 2) : null,
          barcode: barcode?.trim() || null,
          unit: unit?.trim() || "pcs",
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
        include: { customer: { select: { id: true, name: true, code: true } } },
      });

      // 2. Sync to related PackingListItems
      await tx.packingListItem.updateMany({
        where: { productId: id },
        data: {
          productCode: prod.productCode,
          productName: prod.productName,
        },
      });

      // 3. Sync to related DeliveryTicketItems
      await tx.deliveryTicketItem.updateMany({
        where: { productId: id },
        data: {
          productCode: prod.productCode,
          productName: prod.productName,
        },
      });

      return prod;
    });

    // Invalidate next.js client-side router cache for the dashboard
    revalidatePath("/dashboard", "layout");

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

    // Invalidate next.js client-side router cache for the dashboard
    revalidatePath("/dashboard", "layout");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
