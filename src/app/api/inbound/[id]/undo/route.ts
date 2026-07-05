import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the InboundReceipt and its associated stock ledgers
    const receipt = await prisma.inboundReceipt.findUnique({
      where: { id },
      include: {
        stockLedgers: true
      }
    });

    if (!receipt) {
      return NextResponse.json({ error: "Inbound Receipt not found." }, { status: 404 });
    }

    if (receipt.status !== "in_progress" && receipt.status !== "completed") {
      return NextResponse.json({ error: `Cannot undo receipt with status: ${receipt.status}` }, { status: 400 });
    }

    // Check if any stock ledger from this receipt has been reserved or picked
    for (const ledger of receipt.stockLedgers) {
      if (ledger.isReserved || ledger.reservedQty > 0) {
        return NextResponse.json(
          { error: "Cannot undo. Some items in this receipt are currently reserved for picking." },
          { status: 400 }
        );
      }
      
      const pickingItems = await prisma.dOPickingItem.findMany({
        where: { stockLedgerId: ledger.id }
      });
      if (pickingItems.length > 0) {
        return NextResponse.json(
          { error: "Cannot undo. Items from this receipt have been associated with a Delivery Order." },
          { status: 400 }
        );
      }
    }

    // Process Undo in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete stock ledger entries
      if (receipt.stockLedgers.length > 0) {
        await tx.stockLedger.deleteMany({ where: { inboundReceiptId: id } });

        // 2. Re-check each affected pallet position — if no more stock, mark as not occupied
        const affectedPositions = [...new Set(receipt.stockLedgers.map((l) => l.palletPositionId))];
        for (const posId of affectedPositions) {
          const remaining = await tx.stockLedger.count({ where: { palletPositionId: posId } });
          if (remaining === 0) {
            await tx.palletPosition.update({ where: { id: posId }, data: { isOccupied: false } });
          }
        }
      }

      // 3. Update the InboundReceipt status to discrepancy to signify it was undone
      await tx.inboundReceipt.update({
        where: { id },
        data: { 
          status: "discrepancy", 
          notes: (receipt.notes ? receipt.notes + "\n" : "") + "[UNDONE by User]" 
        }
      });
    });

    return NextResponse.json({ success: true, message: "Receipt undone successfully." }, { status: 200 });
  } catch (error: any) {
    console.error("POST /api/inbound/[id]/undo error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
