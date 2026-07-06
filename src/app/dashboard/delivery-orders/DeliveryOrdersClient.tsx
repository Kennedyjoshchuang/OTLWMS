"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { Search, Package, ArrowRight, Printer, Trash2, Clock, MessageSquare, AlertTriangle, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

export default function DeliveryOrdersClient({ initialOrders }: { initialOrders: any[] }) {
  const [search, setSearch] = useState("");
  const [orders] = useState(initialOrders);

  // Delete Request State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/delete-requests?status=pending")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const ids = new Set<string>(data.filter((d) => d.targetModel === "DeliveryOrder").map((d) => d.targetId));
          setPendingDeleteIds(ids);
        }
      })
      .catch(() => {});
  }, []);

  const filtered = orders.filter((o) =>
    o.doNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.deliveryTicket?.deliverToName || "").toLowerCase().includes(search.toLowerCase()) ||
    o.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search PL Number or Deliver To..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            No outbound orders found.
          </div>
        ) : filtered.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-slate-800 text-base">{order.doNumber.replace('OTL-DO-', 'OTL-PL-')}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 mb-0.5">Deliver To</p>
                <p className="text-sm font-semibold text-slate-700">{order.deliveryTicket?.deliverToName || order.customer.name}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                {(() => {
                  const inProgress = ["draft", "picking"].includes(order.status);
                  if (inProgress) {
                    const totalRequired: number = order.deliveryTicket?.items?.reduce((s: number, i: any) => s + (i.delQtyPcs || 0), 0) || 0;
                    
                    if (totalRequired > 0) {
                      const shippedItems = order.pickingItems?.filter((pi: any) => pi.status === "shipped") || [];
                      const totalPicked: number = shippedItems.reduce((s: number, i: any) => s + (i.pickedQty ?? i.requiredQty ?? 0), 0);
                      const pct = Math.min(100, Math.round((totalPicked / totalRequired) * 100));
                      
                      return (
                        <div className="w-24 text-right">
                          <span className="text-[10px] font-semibold text-slate-600">{pct}% Picked</span>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                            <div
                              className={`h-full rounded-full transition-all ${pct === 0 ? "bg-slate-300" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    }
                  }
                  return (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white ${STATUS_COLOR[order.status] || "bg-slate-500"}`}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  );
                })()}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Destination</p>
                <p className="text-sm font-medium text-slate-700 line-clamp-1">{order.destination}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Picker</p>
                <p className="text-sm font-medium text-slate-700">{order.picker?.fullName || "-"}</p>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Items</p>
                <p className="text-sm font-medium text-slate-700">{order.pickingItems.length} items</p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Link
                  href={`/dashboard/delivery-orders/${order.id}`}
                  className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-colors bg-primary/5 flex items-center justify-center"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {pendingDeleteIds.has(order.id) ? (
                  <span className="p-2.5 rounded-xl text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setDeleteTarget(order);
                      setDeleteReason("");
                      setDeleteError("");
                      setDeleteSuccess(false);
                    }}
                    className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors bg-red-50 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">PL Number</th>
              <th className="px-6 py-4 font-semibold">Deliver To</th>
              <th className="px-6 py-4 font-semibold">Destination</th>
              <th className="px-6 py-4 font-semibold">Picker</th>
              <th className="px-6 py-4 font-semibold">Items</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No outbound orders found.
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800">{order.doNumber.replace('OTL-DO-', 'OTL-PL-')}</td>
                  <td className="px-6 py-4">{order.deliveryTicket?.deliverToName || order.customer.name}</td>
                  <td className="px-6 py-4 max-w-[200px] truncate">{order.destination}</td>
                  <td className="px-6 py-4">{order.picker?.fullName || "-"}</td>
                  <td className="px-6 py-4">{order.pickingItems.length} items</td>
                  <td className="px-6 py-4 min-w-[160px]">
                    {(() => {
                      const inProgress = ["draft", "picking"].includes(order.status);
                      if (inProgress) {
                        const totalRequired: number = order.deliveryTicket?.items?.reduce((s: number, i: any) => s + (i.delQtyPcs || 0), 0) || 0;
                        
                        if (totalRequired > 0) {
                          const shippedItems = order.pickingItems?.filter((pi: any) => pi.status === "shipped") || [];
                          const totalPicked: number = shippedItems.reduce((s: number, i: any) => s + (i.pickedQty ?? i.requiredQty ?? 0), 0);
                          const pct = Math.min(100, Math.round((totalPicked / totalRequired) * 100));
                          
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-600">
                                  {pct === 0 ? "Belum di-pick" : `${pct}% Picked`}
                                </span>
                                <span className="text-slate-400">{totalPicked}/{totalRequired} pcs</span>
                              </div>
                              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pct === 0 ? "bg-slate-300" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        }
                      }
                      return (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[order.status] || "bg-slate-500"}`}>
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                    {/* Details */}
                    <Link
                      href={`/dashboard/delivery-orders/${order.id}`}
                      className="inline-flex items-center p-3 sm:p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Details"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>

                    {pendingDeleteIds.has(order.id) ? (
                      <span className="inline-flex items-center p-3 sm:p-2 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200" title="Delete Pending">
                        <Clock className="w-4 h-4" />
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setDeleteTarget(order);
                          setDeleteReason("");
                          setDeleteError("");
                          setDeleteSuccess(false);
                        }}
                        className="inline-flex items-center p-3 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Pengajuan Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
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
                  <p className="text-sm font-semibold text-slate-700">{deleteTarget.doNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Destination: {deleteTarget.destination}</p>
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
                    placeholder="Explain why this Delivery Order should be deleted..."
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
                            targetModel: "DeliveryOrder",
                            targetId: deleteTarget.id,
                            targetLabel: deleteTarget.doNumber,
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
