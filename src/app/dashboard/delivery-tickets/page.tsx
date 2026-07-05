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

  // Get first available customer to pre-fill upload form
  const firstCustomer = await prisma.customer.findFirst({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Pick Lists</h1>
          <p className="text-slate-500 mt-1">Manage and process customer Pick Lists via OCR.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <DeliveryTicketsClient
          initialTickets={JSON.parse(JSON.stringify(tickets))}
          customerId={firstCustomer?.id}
        />
      </div>
    </div>
  );
}

