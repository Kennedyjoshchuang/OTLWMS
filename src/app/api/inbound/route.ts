import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateGRN } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, checkerId, receivedDate, notes, items } = body;

    // Validate required fields
    if (!customerId || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Customer and at least one item are required." },
        { status: 400 }
      );
    }

    // Process in a transaction to ensure data integrity
    const receipt = await prisma.$transaction(async (tx) => {
      // Generate GRN number
      const count = await tx.inboundReceipt.count();
      const receiptNumber = generateGRN(count + 1);

      // Calculate totals from items
      const totalPcsReceived = items.reduce(
        (sum: number, item: any) => sum + (Number(item.qty) || 0),
        0
      );
      const totalLiterReceived = items.reduce(
        (sum: number, item: any) =>
          sum + (Number(item.qty) || 0) * (Number(item.sizeLiter) || 0),
        0
      );

      // Create the InboundReceipt
      const newReceipt = await tx.inboundReceipt.create({
        data: {
          receiptNumber,
          customerId,
          checkerId: checkerId || null,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          totalPcsReceived,
          totalLiterReceived,
          notes: notes || null,
          status: "in_progress",
        },
      });

      // Process each item to create StockLedger and occupy PalletPosition
      for (const item of items) {
        if (!item.rackRowId) {
          throw new Error("Missing location for product: " + item.productCode);
        }
        
        // rackRowId format: "rackId_rackCode_rowNumber"
        const [rackId, rackCode, rowNumberStr] = item.rackRowId.split("_");
        const rowNumber = Number(rowNumberStr);
        const levelNumber = item.levelNumber !== undefined && item.levelNumber !== "" ? Number(item.levelNumber) : null;

        // Build the where clause for finding an available position
        const positionWhere: any = {
          rackId,
          rowNumber,
          isOccupied: false,
        };
        // If user selected a specific tier, target that tier only
        if (levelNumber !== null) positionWhere.levelNumber = levelNumber;

        // Find an available pallet position in this rack row (and tier if specified)
        const availablePosition = await tx.palletPosition.findFirst({
          where: positionWhere,
          orderBy: {
            levelNumber: 'asc', // Fill from bottom up if no tier specified
          }
        });

        if (!availablePosition) {
          const tierInfo = levelNumber !== null ? ` Tier ${levelNumber}` : "";
          throw new Error(`No empty pallet positions available in Rack ${rackCode} Row ${rowNumber}${tierInfo}`);
        }

        // Create StockLedger
        await tx.stockLedger.create({
          data: {
            productId: item.productId,
            palletPositionId: availablePosition.id,
            batchNumber: item.batchNumber || null,
            quantity: Number(item.qty),
            quantityLiter: Number(item.qty) * Number(item.sizeLiter),
            inboundDate: newReceipt.receivedDate,
            inboundReceiptId: newReceipt.id,
          }
        });

        // Mark PalletPosition as occupied
        await tx.palletPosition.update({
          where: { id: availablePosition.id },
          data: { isOccupied: true },
        });
      }

      return newReceipt;
    });

    return NextResponse.json({ success: true, receipt }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/inbound error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
