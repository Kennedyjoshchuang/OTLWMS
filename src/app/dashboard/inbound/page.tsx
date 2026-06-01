import { prisma } from "@/lib/prisma";
import InboundClient from "./InboundClient";

export const dynamic = "force-dynamic";

export default async function InboundPage() {
  const receipts = await prisma.inboundReceipt.findMany({
    include: {
      customer: true,
      checker: true,
      packingList: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inbound (GRN)</h1>
          <p className="text-slate-500 mt-1">Manage incoming goods, packing lists, and verification.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <InboundClient initialReceipts={receipts} />
      </div>
    </div>
  );
}
