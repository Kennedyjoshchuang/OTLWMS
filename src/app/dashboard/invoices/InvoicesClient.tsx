"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Eye,
  Loader2,
  Check,
  X,
  Receipt,
  Filter,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  Settings2,
  Trash2,
  Clock,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { formatDate, hasWriteAccess } from "@/lib/utils";
import { useSession } from "next-auth/react";

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
    deliverToName?: string | null;
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

const MONTHS = [
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

export default function InvoicesClient({ initialInvoices }: { initialInvoices: Invoice[] }) {
  const { data: session } = useSession();
  const canWrite = session?.user ? hasWriteAccess(session.user as any, "/dashboard/invoices") : false;
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Monthly generation state
  const [showMonthlyPanel, setShowMonthlyPanel] = useState(false);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()));
  const [filterByCustomer, setFilterByCustomer] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Delete Request state
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  // Fetch pending delete requests on mount
  useEffect(() => {
    fetch("/api/delete-requests?status=pending")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const ids = new Set<string>(data.filter((d) => d.targetModel === "Invoice").map((d) => d.targetId));
          setPendingDeleteIds(ids);
        }
      })
      .catch(() => {});
  }, []);

  // Derive unique customers from loaded invoices for the customer filter
  const uniqueCustomers = Array.from(
    new Map(invoices.map((inv) => [inv.customerId, inv.customer])).entries()
  ).map(([id, customer]) => ({ id, ...customer }));

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

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

  const handleGenerateMonthly = async () => {
    setGenerating(true);
    setGenerateResult(null);
    try {
      const payload: any = {
        month: selectedMonth,
        year: selectedYear,
      };
      if (filterByCustomer && selectedCustomerIds.length > 0) {
        payload.customerIds = selectedCustomerIds;
      }

      const res = await fetch("/api/invoices/generate-monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setGenerateResult({ type: "error", message: data.error || "Gagal generate invoice." });
        return;
      }

      if (data.generated === 0) {
        setGenerateResult({
          type: "info",
          message: data.message || "Tidak ada delivery ticket yang belum diinvoice pada periode ini.",
        });
        return;
      }

      // Append newly generated invoices to the list
      const newInvoices = data.invoices.map((inv: any) => ({
        ...inv,
        issuedAt: inv.issuedAt,
        dueDate: inv.dueDate,
      }));
      setInvoices((prev) => [...newInvoices, ...prev]);

      const skippedMsg =
        data.skipped > 0 ? ` (${data.skipped} ticket dilewati karena error)` : "";
      setGenerateResult({
        type: "success",
        message: `Berhasil generate ${data.generated} invoice untuk bulan ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}.${skippedMsg}`,
      });
    } catch (err) {
      console.error(err);
      setGenerateResult({ type: "error", message: "Terjadi kesalahan saat generate invoice." });
    } finally {
      setGenerating(false);
    }
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      (inv.deliveryTicket?.deliverToName || "").toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.deliveryTicket.dtNumber.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const resultColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    error: "bg-red-50 border-red-200 text-red-800",
    info: "bg-amber-50 border-amber-200 text-amber-800",
  };

  return (
    <div className="p-6">
      {/* Monthly Billing Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-start">
        <Receipt className="w-5 h-5 text-blue-500 shrink-0 sm:mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-800">Invoice Bulanan Otomatis</p>
          <p className="text-sm text-blue-700 mt-0.5">
            Invoice akan diterbitkan secara <strong>bulanan</strong> berdasarkan rate jasa logistik yang telah disepakati.
            Kelola tarif melalui halaman Pricing.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/pricing"
          className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Kelola Tarif
        </Link>
      </div>

      {/* ── Generate Invoice Bulanan Panel ── */}
      {canWrite && (
        <div className="mb-6 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {/* Header / Toggle */}
          <button
            onClick={() => {
              setShowMonthlyPanel((v) => !v);
              setGenerateResult(null);
            }}
            className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              {/* Checkbox visual */}
              <span
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  showMonthlyPanel
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-slate-300"
                }`}
              >
                {showMonthlyPanel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <CalendarDays className="w-5 h-5 text-indigo-600 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">Generate Invoice Bulanan</p>
                <p className="text-xs text-slate-500">
                  Buat invoice secara massal berdasarkan periode bulan &amp; tahun
                </p>
              </div>
            </div>
            {showMonthlyPanel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {/* Expandable Form */}
          {showMonthlyPanel && (
          <div className="bg-white px-5 py-5 border-t border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Bulan */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Bulan
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tahun */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Tahun
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full border rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter by Customer Toggle */}
            <div className="mt-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={filterByCustomer}
                  onChange={(e) => {
                    setFilterByCustomer(e.target.checked);
                    if (!e.target.checked) setSelectedCustomerIds([]);
                  }}
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <span className="text-sm text-slate-700 font-medium">
                  Filter berdasarkan customer tertentu
                </span>
              </label>

              {filterByCustomer && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  {uniqueCustomers.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Tidak ada customer yang tersedia dari data invoice saat ini.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {uniqueCustomers.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2.5 cursor-pointer select-none p-2 rounded-lg hover:bg-white transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(c.id)}
                            onChange={() => toggleCustomer(c.id)}
                            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                          />
                          <span className="text-sm text-slate-700">{c.name}</span>
                          <span className="text-xs text-slate-400 ml-auto">{c.code}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Result feedback */}
            {generateResult && (
              <div
                className={`mt-4 flex items-start gap-2.5 text-sm rounded-xl px-4 py-3 border ${
                  resultColors[generateResult.type]
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{generateResult.message}</span>
              </div>
            )}

            {/* Action Button */}
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleGenerateMonthly}
                disabled={generating || (filterByCustomer && selectedCustomerIds.length === 0)}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Invoice{" "}
                    {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Invoice, Deliver To, or DT..."
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
              <th className="px-6 py-4 font-semibold">Deliver To</th>
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
                    <div className="font-medium text-slate-800">{inv.deliveryTicket?.deliverToName || inv.customer.name}</div>
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
                        className="p-3 sm:p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex items-center"
                        title="View Details / Print"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>

                      {canWrite ? (
                        <>
                          {inv.status !== "paid" && (
                            <button
                              onClick={() => handleUpdateStatus(inv.id, "paid")}
                              disabled={updatingId === inv.id}
                              className="p-3 sm:p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center"
                              title="Mark as Paid"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}

                          {inv.status === "paid" && (
                            <button
                              onClick={() => handleUpdateStatus(inv.id, "draft")}
                              disabled={updatingId === inv.id}
                              className="p-3 sm:p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors inline-flex items-center"
                              title="Undo (Revert to Draft)"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          {pendingDeleteIds.has(inv.id) ? (
                            <span className="inline-flex items-center gap-1 p-2 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200" title="Delete Pending">
                              <Clock className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setDeleteTarget(inv);
                                setDeleteReason("");
                                setDeleteError("");
                                setDeleteSuccess(false);
                              }}
                              className="p-3 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center"
                              title="Pengajuan Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Read-Only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Delete Request Modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!deleteSubmitting) { setDeleteTarget(null); } }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl p-6">
            {deleteSuccess ? (
              <div className="flex flex-col items-center gap-4 text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Request Submitted!</h3>
                <p className="text-slate-500 text-sm">Your deletion request has been sent to the Owner for review.</p>
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }}
                  className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Request Deletion</h2>
                    <p className="text-xs text-slate-500">Submit a deletion request to the Owner (super admin)</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-sm font-semibold text-slate-700">{deleteTarget.invoiceNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Amount: {formatCurrency(deleteTarget.totalAmount)}</p>
                </div>

                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>This request will be reviewed by the <strong>super admin (Owner)</strong> before deletion is executed.</span>
                </div>

                {deleteError && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {deleteError}
                  </div>
                )}

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Reason for Deletion (optional)
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why this Invoice should be deleted..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { if (!deleteSubmitting) setDeleteTarget(null); }}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDeleteSubmitting(true);
                      setDeleteError("");
                      try {
                        const res = await fetch("/api/delete-requests", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            targetModel: "Invoice",
                            targetId: deleteTarget.id,
                            targetLabel: deleteTarget.invoiceNumber,
                            reason: deleteReason.trim() || null,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to submit request.");
                        setPendingDeleteIds((prev) => new Set([...prev, deleteTarget.id]));
                        setDeleteSuccess(true);
                      } catch (err: any) {
                        setDeleteError(err.message);
                      } finally {
                        setDeleteSubmitting(false);
                      }
                    }}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-red-200 disabled:opacity-70"
                  >
                    {deleteSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><MessageSquare className="w-4 h-4" /> Submit Request</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
