"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, MapPin, CheckCircle2,
  Loader2, Boxes, Undo2, User,
  ChevronDown, ChevronUp, Warehouse, AlertTriangle, Send, Trash2, AlertCircle, MessageSquare,
} from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */
interface AvailableStock {
  stockLedgerId: string;
  positionCode: string;
  rackCode: string;
  rackName: string;
  batchNumber: string | null;
  availableQty: number;
  totalQty: number;
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
  productId: string | null;
  pickedQty: number;
  deliveredQty: number;
  availableStock: AvailableStock[];
  product: { unit: string | null } | null;
}

interface ShippedItem {
  id: string;
  dtItemId: string;
  stockLedgerId: string;
  positionCode: string;
  batchNumber: string | null;
  requiredQty: number;
  pickedQty: number | null;
  status: string;
  product: { productCode: string; productName: string | null; unit: string | null };
}

interface Order {
  id: string;
  doNumber: string;
  status: string;
  destination: string;
  createdAt: string;
  deliveredAt: string | null;
  customer: { name: string };
  picker: { fullName: string } | null;
  currentUserName: string;
}

interface PageData {
  order: Order;
  dtItems: DTItem[];
  shippedItems: ShippedItem[];
}

/* ─── Helper ─────────────────────────────────────────────── */
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

/* ─── Main Component ─────────────────────────────────────── */
export default function DODetailClient({ data }: { data: PageData }) {
  const [order, setOrder] = useState<Order>(data.order);
  const [dtItems, setDtItems] = useState<DTItem[]>(data.dtItems);
  const [shippedItems, setShippedItems] = useState<ShippedItem[]>(data.shippedItems);

  // qty inputs: key = `${dtItemId}__${stockLedgerId}`
  const [qtyInputs, setQtyInputs] = useState<Record<string, number>>({});
  // which pick is loading: key = `${dtItemId}__${stockLedgerId}`
  const [pickingKey, setPickingKey] = useState<string | null>(null);
  const [unpickingId, setUnpickingId] = useState<string | null>(null);
  const [markingDelivered, setMarkingDelivered] = useState(false);
  // expanded DT items (show/hide stock locations)
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(data.dtItems.map((i) => [i.id, true]))
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");

  /* ─── Totals ───────────────────────────────────────────── */
  const totalRequired = dtItems.reduce((s, i) => s + i.delQtyPcs, 0);
  const totalPicked = dtItems.reduce((s, i) => s + i.pickedQty, 0);
  const progressPct = totalRequired > 0 ? Math.min(100, Math.round((totalPicked / totalRequired) * 100)) : 0;
  const isComplete = dtItems.every((i) => i.pickedQty >= i.delQtyPcs);

  /* ─── Handlers ─────────────────────────────────────────── */
  const handlePick = async (dtItem: DTItem, stock: AvailableStock) => {
    const key = `${dtItem.id}__${stock.stockLedgerId}`;
    const qty = qtyInputs[key] ?? 0;

    if (qty <= 0) { alert("Masukkan jumlah yang akan diambil (minimal 1)."); return; }
    if (qty > stock.availableQty) { alert(`Stok tidak cukup. Tersedia: ${stock.availableQty} pcs.`); return; }

    const remaining = dtItem.delQtyPcs - dtItem.pickedQty;
    if (qty > remaining) { alert(`Jumlah mengambil melebihi sisa kebutuhan (${remaining} pcs).`); return; }

    setPickingKey(key);
    try {
      const res = await fetch(`/api/delivery-orders/${order.id}/manual-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dtItemId: dtItem.id, stockLedgerId: stock.stockLedgerId, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal melakukan picking."); return; }

      // Update local DT item picked qty and available stock levels across ALL items
      setDtItems((prev) =>
        prev.map((i) => {
          const isTargetItem = i.id === dtItem.id;
          const newPickedQty = isTargetItem ? i.pickedQty + qty : i.pickedQty;

          return {
            ...i,
            pickedQty: newPickedQty,
            availableStock: i.availableStock.map((s) =>
              s.stockLedgerId === stock.stockLedgerId
                ? { ...s, availableQty: Math.max(0, s.availableQty - qty), totalQty: Math.max(0, s.totalQty - qty) }
                : s
            ),
          };
        })
      );

      // Add to shipped items
      const newShipped: ShippedItem = {
        id: data.newPickingItem.id,
        dtItemId: dtItem.id,
        stockLedgerId: stock.stockLedgerId,
        positionCode: stock.positionCode,
        batchNumber: stock.batchNumber,
        requiredQty: qty,
        pickedQty: qty,
        status: "shipped",
        product: {
          productCode: dtItem.productCode,
          productName: dtItem.productName,
          unit: dtItem.product?.unit || null,
        },
      };
      setShippedItems((prev) => [...prev, newShipped]);

      // Clear this qty input
      setQtyInputs((prev) => { const n = { ...prev }; delete n[key]; return n; });

      if (data.allFulfilled) {
        setOrder((prev) => ({ ...prev, status: "delivered" }));
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setPickingKey(null);
    }
  };

  const handleUnpick = async (shippedItem: ShippedItem) => {
    setUnpickingId(shippedItem.id);
    try {
      const res = await fetch(`/api/delivery-orders/${order.id}/unpick-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickingItemId: shippedItem.id }),
      });
      const resData = await res.json();
      if (!res.ok) { alert(resData.error || "Gagal melakukan unpick."); return; }

      const qtyRestored = shippedItem.pickedQty ?? shippedItem.requiredQty;

      // Check if the stock ledger is present in any of the local availableStock arrays
      const hasStockLedger = dtItems.some((i) =>
        i.availableStock.some((s) => s.stockLedgerId === shippedItem.stockLedgerId)
      );

      if (!hasStockLedger) {
        // Fallback: Reload the page to fetch the restored stock ledger
        window.location.reload();
        return;
      }

      // Remove from shipped list
      setShippedItems((prev) => prev.filter((s) => s.id !== shippedItem.id));

      // Update DT item picked qty + restore stock availability locally
      setDtItems((prev) =>
        prev.map((i) => {
          const isTargetItem = i.id === shippedItem.dtItemId;
          const newPickedQty = isTargetItem ? Math.max(0, i.pickedQty - qtyRestored) : i.pickedQty;

          return {
            ...i,
            pickedQty: newPickedQty,
            availableStock: i.availableStock.map((s) =>
              s.stockLedgerId === shippedItem.stockLedgerId
                ? { ...s, availableQty: s.availableQty + qtyRestored, totalQty: s.totalQty + qtyRestored }
                : s
            ),
          };
        })
      );

      if (order.status === "delivered") {
        setOrder((prev) => ({ ...prev, status: "draft" }));
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setUnpickingId(null);
    }
  };

  const handleMarkDelivered = async () => {
    setMarkingDelivered(true);
    try {
      const res = await fetch(`/api/delivery-orders/${order.id}/mark-delivered`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Gagal update status."); return; }
      setOrder((prev) => ({ ...prev, status: "on_delivery" }));
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setMarkingDelivered(false);
    }
  };

  const setQty = (key: string, val: number, max: number) => {
    setQtyInputs((prev) => ({ ...prev, [key]: Math.max(0, Math.min(val, max)) }));
  };

  const handleDeleteRequest = async () => {
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModel: "DeliveryOrder",
          targetId: order.id,
          targetLabel: order.doNumber,
          reason: deleteReason.trim() || null,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Failed to submit request.");
      setDeleteSuccess(true);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleUndo = async () => {
    if (!confirm("Are you sure you want to revert this DO back to Draft?")) return;
    setUndoing(true);
    setUndoError("");
    try {
      const res = await fetch(`/api/delivery-orders/${order.id}/undo`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to undo DO.");
      window.location.reload();
    } catch (err: any) {
      setUndoError(err.message);
      alert(err.message);
    } finally {
      setUndoing(false);
    }
  };

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/delivery-orders" className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{order.doNumber.replace('OTL-DO-', 'OTL-PL-')}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold text-white ${STATUS_COLOR[order.status] || "bg-slate-500"}`}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
          {order.status !== "draft" && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              className="flex items-center gap-2 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-50"
              title="Revert to Draft"
            >
              {undoing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
              Undo
            </button>
          )}
          <button
            onClick={() => setDeleteModalOpen(true)}
            className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      </div>

      {/* ── Info Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: <User className="w-4 h-4 text-indigo-600" />, bg: "bg-indigo-50", label: "Picker", value: order.currentUserName },
          { icon: <Boxes className="w-4 h-4 text-emerald-600" />, bg: "bg-emerald-50", label: "Progress", value: `${totalPicked} / ${totalRequired} pcs picked` },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-3">
            <div className={`p-2 ${c.bg} rounded-lg`}>{c.icon}</div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase">{c.label}</p>
              <p className="font-semibold text-slate-800 text-sm">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Progress Bar ── */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-semibold text-slate-700">Picking Progress</p>
          <p className="text-sm font-bold text-slate-900">{progressPct}%</p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isComplete ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* ── Completed Banner ── */}
      {isComplete && order.status !== "on_delivery" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3 text-emerald-700">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-semibold">Semua item telah di-pick. Klik <strong>Mark as Delivered</strong> jika barang sudah diserahkan ke customer.</p>
        </div>
      )}
      {order.status === "on_delivery" && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 text-green-700">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="font-semibold">Barang telah diserahkan ke customer. Delivery Order selesai.</p>
        </div>
      )}

      {/* ── DT Items (Picking Targets) ── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-slate-500" />
          Daftar Item & Lokasi Picking
          <span className="text-sm font-normal text-slate-400">— Pilih lokasi rack dan jumlah secara manual</span>
        </h2>

        {dtItems.map((item) => {
          const remaining = item.delQtyPcs - item.pickedQty;
          const itemDone = remaining <= 0;

          return (
            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${itemDone ? "border-emerald-200 opacity-75" : "border-slate-200"}`}>
              {/* Item Header */}
              <div
                className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors ${itemDone ? "bg-emerald-50/50" : ""}`}
                onClick={() => setExpanded((p) => ({ ...p, [item.id]: !p[item.id] }))}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${itemDone ? "bg-emerald-100" : "bg-amber-50"}`}>
                    {itemDone
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      : <Package className="w-4 h-4 text-amber-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 font-mono text-sm">{item.productCode}</span>
                      {item.lotBatchNo && (
                        <span className="text-xs text-slate-400 font-mono">Batch: {item.lotBatchNo}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{item.productName || "—"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Mini progress */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400 font-semibold uppercase">Picked</p>
                    <p className={`font-bold text-sm ${itemDone ? "text-emerald-600" : "text-slate-800"}`}>
                      {item.pickedQty} / {item.delQtyPcs} {item.product?.unit || "pcs"}
                    </p>
                  </div>
                  {!itemDone && (
                    <span className="hidden sm:inline text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                      {remaining} remaining
                    </span>
                  )}
                  {expanded[item.id]
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Stock Location Table */}
              {expanded[item.id] && (
                <div className="border-t border-slate-100">
                  {item.availableStock.length === 0 ? (
                    <div className="px-5 py-6 flex items-center gap-2 text-amber-600 text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Tidak ada stok tersedia di gudang untuk produk ini.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                          <tr>
                            <th className="px-5 py-3 text-left">Lokasi Rack</th>
                            <th className="px-5 py-3 text-left">Batch / Inbound Date</th>
                            <th className="px-5 py-3 text-right">Stok Tersedia</th>
                            <th className="px-5 py-3 text-center">Qty Ambil</th>
                            <th className="px-5 py-3 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {item.availableStock.map((stock) => {
                            const key = `${item.id}__${stock.stockLedgerId}`;
                            const inputVal = qtyInputs[key] ?? 0;
                            const isLoading = pickingKey === key;
                            const itemRemaining = item.delQtyPcs - item.pickedQty;
                            const maxAllowed = Math.min(stock.availableQty, Math.max(0, itemRemaining));

                            return (
                              <tr key={stock.stockLedgerId} className="hover:bg-indigo-50/30 transition-colors">
                                {/* Location Badge */}
                                <td className="px-5 py-3">
                                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold font-mono px-3 py-1.5 rounded-lg">
                                    <MapPin className="w-3 h-3" />
                                    {stock.positionCode}
                                  </span>
                                </td>

                                {/* Batch + Date */}
                                <td className="px-5 py-3">
                                  <p className="text-xs font-mono text-slate-600">{stock.batchNumber || "—"}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(stock.inboundDate)}</p>
                                </td>

                                {/* Available Qty */}
                                <td className="px-5 py-3 text-right">
                                  <span className={`font-bold ${stock.availableQty > 0 ? "text-slate-800" : "text-red-500"}`}>
                                    {stock.availableQty}
                                  </span>
                                  <span className="text-xs text-slate-400 ml-1">{item.product?.unit || "pcs"}</span>
                                </td>

                                {/* Qty Input */}
                                <td className="px-5 py-3">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setQty(key, inputVal - 1, maxAllowed)}
                                      className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors font-bold text-base disabled:opacity-30"
                                      disabled={inputVal <= 0}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      max={maxAllowed}
                                      value={inputVal || ""}
                                      placeholder="0"
                                      onChange={(e) => setQty(key, parseInt(e.target.value) || 0, maxAllowed)}
                                      className="w-16 text-center py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
                                    />
                                    <button
                                      onClick={() => setQty(key, inputVal + 1, maxAllowed)}
                                      className="w-9 h-9 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors font-bold text-base disabled:opacity-30"
                                      disabled={inputVal >= maxAllowed}
                                    >
                                      +
                                    </button>
                                    <button
                                      onClick={() => setQty(key, maxAllowed, maxAllowed)}
                                      className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold ml-1 hover:underline"
                                    >
                                      Max
                                    </button>
                                  </div>
                                </td>

                                {/* Pick Button */}
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => handlePick(item, stock)}
                                    disabled={isLoading || inputVal <= 0 || stock.availableQty === 0 || itemRemaining <= 0}
                                    className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-3 sm:py-2 rounded-xl transition-all shadow-sm w-full sm:w-auto"
                                  >
                                    {isLoading ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    Pick
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Picked Items History ── */}
      {shippedItems.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <h2 className="text-base font-bold text-slate-800">
              Sudah Di-Pick{" "}
              <span className="ml-1 text-sm font-normal text-slate-400">({shippedItems.length} entri)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-left">Produk</th>
                  <th className="px-5 py-3 text-left">Dari Lokasi</th>
                  <th className="px-5 py-3 text-left">Batch</th>
                  <th className="px-5 py-3 text-right">Qty Picked</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {shippedItems.map((si) => (
                  <tr key={si.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-bold text-slate-800 font-mono text-xs">{si.product.productCode}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{si.product.productName}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold font-mono px-2.5 py-1 rounded-lg">
                        <MapPin className="w-3 h-3" />
                        {si.positionCode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs font-mono text-slate-500">{si.batchNumber || "—"}</td>
                    <td className="px-5 py-3 text-right font-black text-slate-800">
                      {si.pickedQty ?? si.requiredQty}
                      <span className="text-xs font-normal text-slate-400 ml-1">{si.product.unit || "pcs"}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleUnpick(si)}
                        disabled={unpickingId === si.id}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-xl transition-colors disabled:opacity-50"
                        title="Batalkan picking & kembalikan stok"
                      >
                        {unpickingId === si.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Undo2 className="w-3 h-3" />}
                        Unpick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                    <h3 className="font-bold text-slate-800">Request DO Deletion</h3>
                    <p className="text-xs text-slate-500">Submit request to Owner for approval</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Delivery Order</p>
                  <p className="font-mono text-sm font-bold text-slate-700">{order.doNumber}</p>
                </div>
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>This request will be reviewed by the <strong>super admin (Owner)</strong>. If approved, the DO will be deleted and any shipped items will be restored to inventory.</span>
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
                    placeholder="Explain why this DO should be deleted..."
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
