import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import DeliveriesClient from "./DeliveriesClient";
import { Truck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id ?? "";
  const userRole = (session?.user as any)?.role ?? "";

  const orders = await prisma.deliveryOrder.findMany({
    where: {
      status: { in: ["delivered", "on_delivery"] },
    },
    include: {
      customer: true,
      driver: true,
      picker: true,
      deliveryTicket: {
        select: {
          dtNumber: true,
          deliverToName: true,
          deliverToAddress: true,
        },
      },
      pickingItems: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="w-7 h-7 text-primary" />
            Deliveries Monitoring
          </h1>
          <p className="text-slate-500 mt-1">
            Driver dapat menandai pengiriman dan menggunakan Undo jika salah.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <DeliveriesClient
          initialOrders={JSON.parse(JSON.stringify(orders))}
          currentUserId={userId}
          currentUserRole={userRole}
        />
      </div>
    </div>
  );
}
