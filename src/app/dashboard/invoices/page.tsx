import { prisma } from "@/lib/prisma";
import InvoicesClient from "./InvoicesClient";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      customer: true,
      deliveryTicket: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const serializedInvoices = invoices.map(inv => ({
    ...inv,
    issuedAt: inv.issuedAt.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Billing & Invoices</h1>
        <p className="text-slate-500 dark:text-zinc-400 mt-1">Manage, view, and track customer invoices for outbound logistics services.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 overflow-hidden transition-colors duration-300">
        <InvoicesClient initialInvoices={serializedInvoices as any} />
      </div>
    </div>
  );
}
