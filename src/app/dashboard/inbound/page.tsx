import { prisma } from "@/lib/prisma";
import InboundClient from "./InboundClient";

export const dynamic = "force-dynamic";

export default async function InboundPage() {
  const [receipts, customers, checkers, products, racks] = await Promise.all([
    prisma.inboundReceipt.findMany({
      include: { customer: true, checker: true, packingList: true },
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
  ]);

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
          initialReceipts={receipts}
          customers={customers}
          checkers={checkers}
          products={products}
          racks={racks}
        />
      </div>
    </div>
  );
}
