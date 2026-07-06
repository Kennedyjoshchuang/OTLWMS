import { prisma } from "@/lib/prisma";
import DeliveryOrdersClient from "./DeliveryOrdersClient";

export const dynamic = "force-dynamic";

export default async function DeliveryOrdersPage() {
  const orders = await prisma.deliveryOrder.findMany({
    include: {
      customer: true,
      picker: true,
      driver: true,
      pickingItems: true,
      deliveryTicket: {
        include: { items: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Outbound</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage outbound delivery orders and picking tasks.</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden transition-colors duration-300">
        <DeliveryOrdersClient initialOrders={orders} />
      </div>
    </div>
  );
}
