import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasWriteAccess, roundFloat } from "@/lib/utils";

// POST /api/products/aggregate
// Aggregate the entire product line into another target product (same customer)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canWrite = hasWriteAccess(session.user as any, "/dashboard/products");
    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden — You do not have write access to this page." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { sourceProductId, targetProductId } = body;

    if (!sourceProductId || !targetProductId) {
      return NextResponse.json(
        { error: "Both sourceProductId and targetProductId are required." },
        { status: 400 }
      );
    }

    if (sourceProductId === targetProductId) {
      return NextResponse.json(
        { error: "Source and target products must be different." },
        { status: 400 }
      );
    }

    // Fetch both products
    const [sourceProduct, targetProduct] = await Promise.all([
      prisma.product.findUnique({
        where: { id: sourceProductId },
        include: { customer: true },
      }),
      prisma.product.findUnique({
        where: { id: targetProductId },
        include: { customer: true },
      }),
    ]);

    if (!sourceProduct) {
      return NextResponse.json({ error: "Source product not found." }, { status: 404 });
    }

    if (!targetProduct) {
      return NextResponse.json({ error: "Target product not found." }, { status: 404 });
    }

    if (sourceProduct.customerId !== targetProduct.customerId) {
      return NextResponse.json(
        { error: "Products must belong to the same customer to be aggregated." },
        { status: 400 }
      );
    }

    const targetSizeLiter = targetProduct.sizeLiter || 0;

    await prisma.$transaction(async (tx) => {
      // 1. Fetch all stock ledgers of source product to calculate new liters
      const sourceLedgers = await tx.stockLedger.findMany({
        where: { productId: sourceProductId },
      });

      // Update each stock ledger to the target product with recalculated liters
      for (const sl of sourceLedgers) {
        const newLiter = roundFloat(sl.quantity * targetSizeLiter, 2);
        await tx.stockLedger.update({
          where: { id: sl.id },
          data: {
            productId: targetProductId,
            quantityLiter: newLiter,
          },
        });
      }

      // 2. Update active (non-shipped) picking items
      await tx.dOPickingItem.updateMany({
        where: {
          productId: sourceProductId,
          status: { not: "shipped" },
        },
        data: {
          productId: targetProductId,
        },
      });

      // 3. Update packing list items
      await tx.packingListItem.updateMany({
        where: { productId: sourceProductId },
        data: {
          productId: targetProductId,
          productCode: targetProduct.productCode,
          productName: targetProduct.productName,
        },
      });

      // 4. Update delivery ticket items
      await tx.deliveryTicketItem.updateMany({
        where: { productId: sourceProductId },
        data: {
          productId: targetProductId,
          productCode: targetProduct.productCode,
          productName: targetProduct.productName,
        },
      });

      // 5. Transfer stock movements
      await tx.stockMovement.updateMany({
        where: { productId: sourceProductId },
        data: { productId: targetProductId },
      });

      // 6. Record StockMovement log for aggregation audit
      const totalMovedQty = sourceLedgers.reduce((sum, sl) => sum + sl.quantity, 0);
      await tx.stockMovement.create({
        data: {
          productId: targetProductId,
          movementType: "adjustment",
          quantity: totalMovedQty,
          quantityBefore: totalMovedQty,
          quantityAfter: totalMovedQty,
          notes: `Product line aggregated: Merged ${sourceProduct.productCode} (${sourceProduct.productName}) into ${targetProduct.productCode} (${targetProduct.productName}). Total ${totalMovedQty} pcs affected across ${sourceLedgers.length} stock ledger records.`,
          performedById: (session.user as any)?.id || null,
        },
      });

      // 7. Soft-deactivate source product and rename code to avoid conflicts if needed
      await tx.product.update({
        where: { id: sourceProductId },
        data: {
          isActive: false,
        },
      });
    });

    revalidatePath("/dashboard", "layout");

    return NextResponse.json({
      success: true,
      message: `Product ${sourceProduct.productCode} aggregated successfully into ${targetProduct.productCode}.`,
    });
  } catch (error: any) {
    console.error("POST /api/products/aggregate error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
