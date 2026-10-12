import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasWriteAccess, roundFloat } from "@/lib/utils";

// POST /api/warehouse/convert-block
// Turn a block of product at a pallet position into another product (same customer)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canWrite = hasWriteAccess(session.user as any, "/dashboard/warehouse");
    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden — You do not have write access to this page." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { palletPositionId, sourceProductId, targetProductId } = body;

    if (!palletPositionId || !sourceProductId || !targetProductId) {
      return NextResponse.json(
        { error: "palletPositionId, sourceProductId, and targetProductId are required." },
        { status: 400 }
      );
    }

    if (sourceProductId === targetProductId) {
      return NextResponse.json(
        { error: "Source and target products must be different." },
        { status: 400 }
      );
    }

    // Verify position exists
    const position = await prisma.palletPosition.findUnique({
      where: { id: palletPositionId },
    });

    if (!position) {
      return NextResponse.json({ error: "Pallet position not found." }, { status: 404 });
    }

    // Fetch both products
    const [sourceProduct, targetProduct] = await Promise.all([
      prisma.product.findUnique({
        where: { id: sourceProductId },
      }),
      prisma.product.findUnique({
        where: { id: targetProductId },
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
        { error: "Both products must belong to the same customer." },
        { status: 400 }
      );
    }

    // Find active stock ledgers at this position
    const targetSizeLiter = targetProduct.sizeLiter || 0;

    const ledgers = await prisma.stockLedger.findMany({
      where: {
        palletPositionId,
        productId: sourceProductId,
        quantity: { gt: 0 },
      },
    });

    if (ledgers.length === 0) {
      return NextResponse.json(
        { error: "No active stock found for this product at this pallet position." },
        { status: 404 }
      );
    }

    const totalQtyConverted = ledgers.reduce((sum, sl) => sum + sl.quantity, 0);
    const ledgerIds = ledgers.map((l) => l.id);

    await prisma.$transaction(async (tx) => {
      // 1. Update each stock ledger to the new product and recalculate liters
      for (const sl of ledgers) {
        const newLiter = roundFloat(sl.quantity * targetSizeLiter, 2);
        await tx.stockLedger.update({
          where: { id: sl.id },
          data: {
            productId: targetProductId,
            quantityLiter: newLiter,
          },
        });
      }

      // 2. Update active (non-shipped) picking items tied to these ledgers
      await tx.dOPickingItem.updateMany({
        where: {
          stockLedgerId: { in: ledgerIds },
          status: { not: "shipped" },
        },
        data: {
          productId: targetProductId,
        },
      });

      // 3. Record audit StockMovement
      await tx.stockMovement.create({
        data: {
          productId: targetProductId,
          palletPositionId,
          movementType: "adjustment",
          quantity: totalQtyConverted,
          quantityBefore: totalQtyConverted,
          quantityAfter: totalQtyConverted,
          notes: `Converted ${totalQtyConverted} pcs at position ${position.positionCode} from ${sourceProduct.productCode} (${sourceProduct.productName}) to ${targetProduct.productCode} (${targetProduct.productName})`,
          performedById: (session.user as any)?.id || null,
        },
      });
    });

    revalidatePath("/dashboard", "layout");

    return NextResponse.json({
      success: true,
      message: `Successfully converted stock block at ${position.positionCode} to ${targetProduct.productCode}.`,
    });
  } catch (error: any) {
    console.error("POST /api/warehouse/convert-block error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
