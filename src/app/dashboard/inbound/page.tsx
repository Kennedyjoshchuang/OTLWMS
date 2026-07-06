import { prisma } from "@/lib/prisma";
import InboundClient from "./InboundClient";

export const dynamic = "force-dynamic";

export default async function InboundPage() {
  const [rawReceipts, customers, checkers, products, racks, deletedRequests] = await Promise.all([
    prisma.inboundReceipt.findMany({
      include: { 
        customer: true, 
        checker: true, 
        packingList: true,
        stockLedgers: {
          select: { quantity: true }
        }
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["checker_inbound", "warehouse_admin", "super_admin"] }, isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { productCode: "asc" },
      select: { id: true, productCode: true, productName: true, sizeLiter: true, weightKg: true },
    }),
    prisma.warehouseRack.findMany({
      include: { positions: true },
      orderBy: { rackCode: "asc" },
    }),
    (prisma as any).deleteRequest.findMany({
      where: { targetModel: "InboundReceipt", status: "deleted" },
      include: { requestedBy: { select: { fullName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const receipts = rawReceipts.map(receipt => {
    let calculatedStatus = receipt.status;
    let currentQty = receipt.totalPcsReceived;
    let outboundedQty = 0;

    if (receipt.stockLedgers.length > 0) {
      currentQty = receipt.stockLedgers.reduce((sum, sl) => sum + sl.quantity, 0);
      outboundedQty = Math.max(0, receipt.totalPcsReceived - currentQty);

      // Check if the GRN is currently considered "inbound" / in progress
      if (receipt.status === "in_progress" || receipt.status === "completed") {
        // If all items from this GRN have left the warehouse
        if (currentQty === 0) {
          calculatedStatus = "outbounded";
        } else if (outboundedQty > 0) {
          calculatedStatus = "partially_outbounded";
        }
      }
    }

    return {
      ...receipt,
      status: calculatedStatus,
      outboundedQty,
      isDeleted: false,
    };
  });

  // Create ghost rows for hard-deleted GRNs that have an approved delete request
  const ghostRows = deletedRequests.map((dr: any) => ({
    id: dr.id,
    receiptNumber: dr.targetLabel,
    customer: null,
    checker: null,
    receivedDate: dr.updatedAt,
    totalPcsReceived: 0,
    totalLiterReceived: 0,
    status: "deleted",
    outboundedQty: 0,
    isDeleted: true,
    deletedAt: dr.updatedAt,
    deletedReason: dr.reviewNote || dr.reason || null,
    requestedBy: dr.requestedBy?.fullName || null,
  }));

  // Merge: real receipts first, then ghost deleted rows
  const allReceipts = [...receipts, ...ghostRows];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inbound (GRN)</h1>
          <p className="text-slate-500 mt-1">Manage incoming goods, packing lists, and verification.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <InboundClient
          initialReceipts={allReceipts}
          customers={customers}
          checkers={checkers}
          products={products}
          racks={racks}
        />
      </div>
    </div>
  );
}
