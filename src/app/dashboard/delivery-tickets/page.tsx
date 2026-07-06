import { prisma } from "@/lib/prisma";
import DeliveryTicketsClient from "./DeliveryTicketsClient";

export const dynamic = "force-dynamic";

export default async function DeliveryTicketsPage() {
  const tickets = await prisma.deliveryTicket.findMany({
    include: {
      customer: true,
      items: true,
      createdBy: true,
      invoice: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Get customers for assignment
  const customers = await prisma.customer.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Pick Lists</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage and process customer Pick Lists via OCR.</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden transition-colors duration-300">
        <DeliveryTicketsClient
          initialTickets={JSON.parse(JSON.stringify(tickets))}
          customers={JSON.parse(JSON.stringify(customers))}
        />
      </div>
    </div>
  );
}

