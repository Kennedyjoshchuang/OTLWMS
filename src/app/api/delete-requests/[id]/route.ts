import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/delete-requests/[id] — approve or reject (super_admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = (session.user as any)?.role;
    if (role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden — only super_admin can approve or reject deletion requests." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reviewNote } = body; // action: "approve" | "reject"

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "action must be 'approve' or 'reject'." }, { status: 400 });
    }

    // Fetch the request
    const deleteRequest = await (prisma as any).deleteRequest.findUnique({ where: { id } });
    if (!deleteRequest) {
      return NextResponse.json({ error: "Deletion request not found." }, { status: 404 });
    }
    if (deleteRequest.status !== "pending") {
      return NextResponse.json({ error: `Request is already ${deleteRequest.status}.` }, { status: 409 });
    }

    if (action === "reject") {
      const updated = await (prisma as any).deleteRequest.update({
        where: { id },
        data: { status: "rejected", reviewNote: reviewNote?.trim() || null, updatedAt: new Date() },
      });
      return NextResponse.json(updated);
    }

    // ── APPROVE: execute the actual deletion ──────────────────────────────
    const { targetModel, targetId } = deleteRequest;

    if (targetModel === "InboundReceipt") {
      // 1. Fetch all stock ledger entries for this receipt
      const ledgers = await prisma.stockLedger.findMany({
        where: { inboundReceiptId: targetId },
        select: { id: true, palletPositionId: true },
      });

      // 2. Delete stock ledger entries
      if (ledgers.length > 0) {
        await prisma.stockLedger.deleteMany({ where: { inboundReceiptId: targetId } });

        // 3. Re-check each affected pallet position — if no more stock, mark as not occupied
        const affectedPositions = [...new Set(ledgers.map((l) => l.palletPositionId))];
        for (const posId of affectedPositions) {
          const remaining = await prisma.stockLedger.count({ where: { palletPositionId: posId } });
          if (remaining === 0) {
            await prisma.palletPosition.update({ where: { id: posId }, data: { isOccupied: false } });
          }
        }
      }

      // 4. Delete the InboundReceipt
      await prisma.inboundReceipt.delete({ where: { id: targetId } });

    } else if (targetModel === "Product") {
      // Soft-delete
      await prisma.product.update({ where: { id: targetId }, data: { isActive: false } });

    } else if (targetModel === "Customer") {
      // Soft-delete
      await prisma.customer.update({ where: { id: targetId }, data: { isActive: false } });

    } else if (targetModel === "Invoice") {
      // Hard-delete (cascades to InvoiceItem via schema)
      await prisma.invoice.delete({ where: { id: targetId } });

    } else if (targetModel === "DeliveryOrder") {
      const DO = await prisma.deliveryOrder.findUnique({
        where: { id: targetId },
        include: { pickingItems: true }
      });
      if (DO) {
        // Delete all DOPickingItems (and restore stock if shipped)
        for (const pi of DO.pickingItems) {
          if (pi.status === "shipped") {
            const qtyRestored = pi.pickedQty ?? pi.requiredQty;
            await prisma.stockLedger.update({
              where: { id: pi.stockLedgerId },
              data: { quantity: { increment: qtyRestored } }
            });
            await prisma.deliveryTicketItem.update({
              where: { id: pi.dtItemId },
              data: { deliveredQty: { decrement: qtyRestored } }
            });
          }
          await prisma.dOPickingItem.delete({ where: { id: pi.id } });
        }
        await prisma.deliveryOrder.delete({ where: { id: targetId } });
      }

    } else if (targetModel === "DeliveryTicket") {
      const DT = await prisma.deliveryTicket.findUnique({
        where: { id: targetId },
        include: { deliveryOrders: true }
      });
      if (DT && DT.deliveryOrders.length > 0) {
        return NextResponse.json({ error: "Cannot delete Delivery Ticket because it has associated Delivery Orders. Please delete the Delivery Orders first." }, { status: 400 });
      }
      await prisma.deliveryTicketItem.deleteMany({ where: { deliveryTicketId: targetId } });
      await prisma.deliveryTicket.delete({ where: { id: targetId } });

    } else if (targetModel === "PackingList") {
      const PL = await prisma.packingList.findUnique({
        where: { id: targetId },
        include: { receipts: true }
      });
      if (PL && PL.receipts.length > 0) {
        return NextResponse.json({ error: "Cannot delete Packing List because it has associated Inbound Receipts. Please delete the receipts first." }, { status: 400 });
      }
      await prisma.packingListItem.deleteMany({ where: { packingListId: targetId } });
      await prisma.packingList.delete({ where: { id: targetId } });
    }

    // 5. Mark the delete request as approved
    const updated = await (prisma as any).deleteRequest.update({
      where: { id },
      data: { status: "approved", reviewNote: reviewNote?.trim() || null, updatedAt: new Date() },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/delete-requests/[id] error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
