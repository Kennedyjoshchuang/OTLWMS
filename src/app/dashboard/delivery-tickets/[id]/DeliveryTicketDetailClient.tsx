"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileText, MapPin, Package, CheckCircle2, Clock, Trash2, Loader2, AlertCircle, AlertTriangle, MessageSquare, Undo2 } from "lucide-react";
import OmegaDTPrintView from "./OmegaDTPrintView";

interface Location {
  positionCode: string;
  rackCode: string;
  rackName: string;
  batchNumber: string | null;
  availableQty: number;
  inboundDate: string;
}

interface DTItem {
  id: string;
  lineNo: number | null;
  productCode: string;
  productName: string | null;
  lotBatchNo: string | null;
  delQtyPcs: number;
  delQtyLiter: number | null;
  status: string;
  locations: Location[];
}

interface Ticket {
  id: string;
  dtNumber: string;
  orderNumber: string | null;
  customerPoNo: string | null;
  deliverToName: string | null;
  deliverToAddress: string | null;
  deliveryDate: string | null;
  ocrStatus: string;
  status: string;
  createdAt: string;
  customer: { id: string; name: string; code: string };
  createdBy: { fullName: string } | null;
  items: DTItem[];
  deliveryOrders: { id: string; doNumber: string; status: string }[];
  invoice: { id: string; invoiceNumber: string; status: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-400",
  ready: "bg-blue-500",
  picking: "bg-amber-500",
  shipped: "bg-indigo-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-red-500",
  completed: "bg-emerald-500",
  pending: "bg-slate-400",
  processing: "bg-amber-500",
  failed: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Waiting to be Picked",
  picking: "Picking",
  shipped: "Shipped",
  delivered: "Picked",
  cancelled: "Cancelled",
  completed: "Completed",
  pending: "Pending",
  processing: "Processing",
  failed: "Failed",
};

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function DeliveryTicketDetailClient({ ticket }: { ticket: Ticket }) {
  const [activeTab, setActiveTab] = useState<"jotun" | "omega">("omega");
  const [showPrint, setShowPrint] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");

  const handleDeleteRequest = async () => {
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModel: "DeliveryTicket",
          targetId: ticket.id,
          targetLabel: ticket.dtNumber,
          reason: deleteReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");
      setDeleteSuccess(true);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (!confirm("Are you sure you want to revert this Delivery Ticket back to Draft?")) return;
    setUndoing(true);
    setUndoError("");
    try {
      const res = await fetch(`/api/delivery-tickets/${ticket.id}/undo`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to undo ticket.");
      window.location.reload();
    } catch (err: any) {
      setUndoError(err.message);
      alert(err.message);
    } finally {
      setUndoing(false);
    }
  };

  if (showPrint) {
    return <OmegaDTPrintView ticket={ticket} onClose={() => setShowPrint(false)} />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/delivery-tickets"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              DT {ticket.dtNumber}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {ticket.customer.name} · {formatDate(ticket.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
              STATUS_COLOR[ticket.status] || "bg-slate-400"
            }`}
          >
            {STATUS_LABEL[ticket.status] || ticket.status}
          </span>
          {ticket.status !== "draft" && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="flex items-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 px-4 py-2 rounded-xl font-medium transition-all disabled:opacity-50"
              title="Revert to Draft"
            >
              {undoing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              Undo
            </button>
          )}
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2 rounded-xl font-medium transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete Request
          </button>
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg"
          >
            <Printer className="w-4 h-4" />
            Print Omega DT
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Customer</p>
          <p className="font-bold text-slate-800 mt-1">{ticket.customer.name}</p>
          <p className="text-xs text-slate-400">{ticket.customer.code}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Deliver To</p>
          <p className="font-bold text-slate-800 mt-1">{ticket.deliverToName || "-"}</p>
          <p className="text-xs text-slate-400">{ticket.deliverToAddress || ""}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Delivery Date</p>
          <p className="font-bold text-slate-800 mt-1">{formatDate(ticket.deliveryDate)}</p>
          <p className="text-xs text-slate-400">Order: {ticket.orderNumber || "-"}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Items</p>
          <p className="font-bold text-slate-800 mt-1">{ticket.items.length} products</p>
          <p className="text-xs text-slate-400">
            {ticket.items.reduce((s, i) => s + i.delQtyPcs, 0)} pcs total
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("omega")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === "omega"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Omega Trust DT
            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full ml-1">
              with Locations
            </span>
          </button>
          <button
            onClick={() => setActiveTab("jotun")}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors ${
              activeTab === "jotun"
                ? "border-b-2 border-slate-700 text-slate-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Jotun Source DT
          </button>
        </div>

        {/* Omega Trust DT Tab */}
        {activeTab === "omega" && (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">Omega Trust Delivery Ticket</p>
                <p className="text-xs text-slate-500">
                  Warehouse locations automatically resolved · FIFO order
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">No</th>
                    <th className="px-4 py-3 font-semibold">Product Code</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold">Batch No</th>
                    <th className="px-4 py-3 font-semibold text-right">Qty (pcs)</th>
                    <th className="px-4 py-3 font-semibold text-right">Qty (L)</th>
                    <th className="px-4 py-3 font-semibold">Warehouse Location</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ticket.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 text-slate-400 font-mono text-xs">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-800 font-mono">
                        {item.productCode}
                      </td>
                      <td className="px-4 py-4 text-slate-600 max-w-[200px]">
                        {item.productName || "-"}
                      </td>
                      <td className="px-4 py-4 text-slate-500 font-mono text-xs">
                        {item.lotBatchNo || "-"}
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-slate-800">
                        {item.delQtyPcs}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {item.delQtyLiter?.toFixed(1) || "-"}
                      </td>
                      <td className="px-4 py-4">
                        {item.locations.length === 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            <Clock className="w-3 h-3" />
                            No stock found
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {item.locations.map((loc, li) => (
                              <div key={li} className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                  <MapPin className="w-3 h-3" />
                                  {loc.positionCode}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {loc.availableQty} avail
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${
                            STATUS_COLOR[item.status] || "bg-slate-400"
                          }`}
                        >
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {ticket.items.some((i) => i.locations.length > 0) && (
              <div className="mt-4 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Warehouse locations resolved via FIFO. Staff can proceed directly to picking
                  based on the locations above.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Jotun DT Tab */}
        {activeTab === "jotun" && (
          <div className="p-6">
            <div className="bg-slate-50 rounded-xl border p-6">
              {/* Jotun DT Header */}
              <div className="flex justify-between border-b pb-4 mb-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-semibold">Source Document</p>
                  <h2 className="text-xl font-bold text-slate-800 mt-1">PT. JOTUN INDONESIA</h2>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-semibold">DT Number</p>
                  <p className="font-bold text-slate-800 mt-1 border px-3 py-1 rounded-lg text-lg">
                    {ticket.dtNumber}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Deliver To</p>
                  <p className="font-semibold text-slate-800 mt-1">{ticket.deliverToName || "-"}</p>
                  <p className="text-slate-600 text-sm">{ticket.deliverToAddress || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase">Order Info</p>
                  <p className="text-slate-700 mt-1">Order No: <strong>{ticket.orderNumber || "-"}</strong></p>
                  <p className="text-slate-700">PO No: <strong>{ticket.customerPoNo || "-"}</strong></p>
                </div>
              </div>

              <table className="w-full border-collapse border text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 text-left">Product Code</th>
                    <th className="border p-2 text-left">Description</th>
                    <th className="border p-2 text-left">Batch No</th>
                    <th className="border p-2 text-right">Qty (pcs)</th>
                    <th className="border p-2 text-right">Qty (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.items.map((item) => (
                    <tr key={item.id} className="even:bg-slate-50">
                      <td className="border p-2 font-mono font-semibold">{item.productCode}</td>
                      <td className="border p-2">{item.productName || "-"}</td>
                      <td className="border p-2 font-mono text-xs">{item.lotBatchNo || "-"}</td>
                      <td className="border p-2 text-right font-bold">{item.delQtyPcs}</td>
                      <td className="border p-2 text-right">{item.delQtyLiter?.toFixed(1) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!deleteSubmitting) setDeleteModalOpen(false); }}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl p-6">
            {deleteSuccess ? (
              <div className="flex flex-col items-center gap-4 text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Request Submitted!</h3>
                <p className="text-slate-500 text-sm">Your deletion request has been sent to the Owner for review.</p>
                <button
                  onClick={() => { setDeleteModalOpen(false); setDeleteSuccess(false); setDeleteReason(""); }}
                  className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Request DT Deletion</h3>
                    <p className="text-xs text-slate-500">Submit request to Owner for approval</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Delivery Ticket</p>
                  <p className="font-mono text-sm font-bold text-slate-700">{ticket.dtNumber}</p>
                </div>
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>This request will be reviewed by the <strong>super admin (Owner)</strong>. If approved, this DT will be permanently deleted.</span>
                </div>
                {deleteError && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {deleteError}
                  </div>
                )}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Reason (optional)</label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={2}
                    placeholder="Explain why this ticket should be deleted..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { if (!deleteSubmitting) setDeleteModalOpen(false); }}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteRequest}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70"
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
