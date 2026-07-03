"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Eye, Loader2, Check, X, Trash2, Receipt, Calendar, Building, DollarSign, Filter } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Invoice {
  id: string;
  invoiceNumber: string;
  deliveryTicketId: string;
  customerId: string;
  totalAmount: number;
  status: string; // draft | sent | paid | cancelled
  issuedAt: string;
  dueDate: string;
  customer: {
    name: string;
    code: string;
  };
  deliveryTicket: {
    dtNumber: string;
  };
}

const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

export default function InvoicesClient({ initialInvoices }: { initialInvoices: Invoice[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleUpdateStatus = async (invoiceId: string, newStatus: string) => {
    setUpdatingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update invoice status");
        return;
      }
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
      );
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice? This action cannot be undone.")) {
      return;
    }
    setUpdatingId(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to delete invoice");
        return;
      }
      setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting invoice");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.deliveryTicket.dtNumber.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Invoice, Customer, or DT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all w-full md:w-40"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">Invoice No</th>
              <th className="px-6 py-4 font-semibold">Customer</th>
              <th className="px-6 py-4 font-semibold">Delivery Ticket</th>
              <th className="px-6 py-4 font-semibold">Date Issued</th>
              <th className="px-6 py-4 font-semibold">Due Date</th>
              <th className="px-6 py-4 font-semibold">Amount</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                  <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No invoices found.
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                    <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                      <Receipt className="w-4 h-4" />
                    </span>
                    {inv.invoiceNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{inv.customer.name}</div>
                    <div className="text-xs text-slate-400">{inv.customer.code}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">{inv.deliveryTicket.dtNumber}</td>
                  <td className="px-6 py-4">{formatDate(inv.issuedAt)}</td>
                  <td className="px-6 py-4">{formatDate(inv.dueDate)}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    {formatCurrency(inv.totalAmount)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        INVOICE_STATUS_COLOR[inv.status] || "bg-slate-500 text-white"
                      }`}
                    >
                      {INVOICE_STATUS_LABEL[inv.status] || inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Link
                        href={`/dashboard/invoices/${inv.id}`}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="View Details / Print"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {inv.status !== "paid" && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, "paid")}
                          disabled={updatingId === inv.id}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Mark as Paid"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}

                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, "sent")}
                          disabled={updatingId === inv.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Mark as Sent"
                        >
                          <span className="text-xs font-bold font-sans">Sent</span>
                        </button>
                      )}

                      {inv.status === "paid" && (
                        <button
                          onClick={() => handleUpdateStatus(inv.id, "draft")}
                          disabled={updatingId === inv.id}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Revert to Draft"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteInvoice(inv.id)}
                        disabled={updatingId === inv.id}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
