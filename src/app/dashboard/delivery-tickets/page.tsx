import { prisma } from "@/lib/prisma";
import DeliveryTicketsClient from "./DeliveryTicketsClient";

export const dynamic = "force-dynamic";

export default async function DeliveryTicketsPage() {
  const tickets = await prisma.deliveryTicket.findMany({
    include: {
      customer: true,
      items: true,
      createdBy: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Delivery Tickets</h1>
          <p className="text-slate-500 mt-1">Manage and process customer Delivery Tickets via OCR.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <DeliveryTicketsClient initialTickets={tickets} />
      </div>
    </div>
  );
}
