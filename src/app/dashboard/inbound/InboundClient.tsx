"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import {
  Search, Inbox, Plus, X, Trash2,
  PackagePlus, Loader2, CheckCircle2, AlertCircle, AlertTriangle,
  Clock, MessageSquare, Undo2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  productCode: string;
  productName: string;
  sizeLiter: number | null;
  weightKg: number | null;
}
interface Customer { id: string; name: string }
interface Checker  { id: string; fullName: string }

interface InboundItem {
  productId: string;
  productCode: string;
  productName: string;
  sizeLiter: number;
  batchNumber: string;
  qty: number;
  rackRowId: string;
  levelNumber: number | "";
}

interface Props {
  initialReceipts: any[];
  customers: Customer[];
  checkers: Checker[];
  products: Product[];
  racks?: any[];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function InboundClient({
  initialReceipts,
  customers,
  checkers,
  products,
  racks = [],
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { data: session } = useSession();

  // Table search
  const [search, setSearch] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Undo state
  const [undoTargetId, setUndoTargetId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState("");
  const [undoSuccess, setUndoSuccess] = useState(false);

  // Delete request state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
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
          const ids = new Set<string>(data.filter((d) => d.targetModel === "InboundReceipt").map((d) => d.targetId));
          setPendingDeleteIds(ids);
        }
      })
      .catch(() => {});
  }, []);

  // Form state
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [additionalCustomers, setAdditionalCustomers] = useState<Customer[]>([]);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [checkerId, setCheckerId]   = useState("");
  const [hasAutoSetChecker, setHasAutoSetChecker] = useState(false);

  useEffect(() => {
    if (session?.user && !hasAutoSetChecker) {
      const uId = (session.user as any).id;
      if (checkers.some(c => c.id === uId)) {
        setCheckerId(uId);
      }
      setHasAutoSetChecker(true);
    }
  }, [session, checkers, hasAutoSetChecker]);

  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InboundItem[]>([
    { productId: "", productCode: "", productName: "", sizeLiter: 5, batchNumber: "", qty: 1, rackRowId: "", levelNumber: "" },
  ]);

  // Compute Product options for Select
  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p.id,
      label: `${p.productCode} — ${p.productName}`
    }));
  }, [products]);

  // Compute Rack & Row options with capacity
  const rackRowOptions = useMemo(() => {
    const options: { id: string; label: string; isFull: boolean }[] = [];
    racks.forEach((rack) => {
      const rowMap = new Map<number, any[]>();
      rack.positions.forEach((p: any) => {
        if (!rowMap.has(p.rowNumber)) rowMap.set(p.rowNumber, []);
        rowMap.get(p.rowNumber)!.push(p);
      });
      Array.from(rowMap.entries())
        .sort(([a], [b]) => a - b)
        .forEach(([rowNumber, positions]) => {
          let totalLiter = 0;
          positions.forEach(p => {
             p.stockLedgers?.forEach((sl: any) => {
               totalLiter += (sl.quantityLiter || 0);
             });
          });
          
          const total = positions.length;
          const occupied = positions.filter((p) => p.isOccupied).length;
          const isFull = total > 0 && occupied >= total;
          
          options.push({
            id: `${rack.id}_${rack.rackCode}_${rowNumber}`,
            label: `${rack.rackCode === "FLOOR" ? "Floor" : `Rack ${rack.rackCode}`} - Row ${String(rowNumber).padStart(2, "0")} (${totalLiter.toFixed(1)} L loaded)`,
            isFull,
          });
        });
    });
    return options;
  }, [racks]);

  // Compute Location options for Select
  const locationOptions = useMemo(() => {
    return rackRowOptions.map(opt => ({
      value: opt.id,
      label: opt.isFull ? `${opt.label} (FULL)` : opt.label,
      isDisabled: opt.isFull
    }));
  }, [rackRowOptions]);

  // Compute level (tier) options for a given rackRowId
  const getLevelOptions = (rackRowId: string) => {
    if (!rackRowId) return [];
    const parts = rackRowId.split("_");
    const rackId = parts[0];
    const rowNumber = Number(parts[2]);
    const rack = racks.find((r: any) => r.id === rackId);
    if (!rack) return [];

    const rowPositions = rack.positions.filter((p: any) => p.rowNumber === rowNumber);
    const levelMap = new Map<number, any[]>();
    rowPositions.forEach((p: any) => {
      if (!levelMap.has(p.levelNumber)) levelMap.set(p.levelNumber, []);
      levelMap.get(p.levelNumber)!.push(p);
    });

    return Array.from(levelMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([levelNumber, positions]) => {
        let totalLiter = 0;
        positions.forEach((p: any) => {
          p.stockLedgers?.forEach((sl: any) => {
            totalLiter += (sl.quantityLiter || 0);
          });
        });
        
        const occupied = positions.filter((p: any) => p.isOccupied).length;
        const total = positions.length;
        const isFull = total > 0 && occupied >= total;
        const posCode = positions[0]?.positionCode || `Tier ${levelNumber}`;
        return {
          value: levelNumber,
          label: `${posCode} — ${totalLiter.toFixed(1)} L loaded${isFull ? " (FULL)" : ""}`,
          isDisabled: isFull,
        };
      });
  };

  // ── Filter table
  const filtered = initialReceipts.filter(
    (r) =>
      r.receiptNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Item helpers
  const handleProductChange = (idx: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              productId: productId,
              productCode: p?.productCode ?? "",
              productName: p?.productName ?? "",
              sizeLiter: p?.sizeLiter ?? 5,
            }
          : it
      )
    );
  };

  const handleItemChange = (
    idx: number,
    field: keyof InboundItem,
    value: string | number
  ) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        // Reset level when row changes
        if (field === "rackRowId") return { ...it, rackRowId: String(value), levelNumber: "" };
        return { ...it, [field]: value };
      })
    );
  };

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { productId: "", productCode: "", productName: "", sizeLiter: 5, batchNumber: "", qty: 1, rackRowId: "", levelNumber: "" },
    ]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // ── Reset form
  const resetForm = () => {
    setCustomerId(customers[0]?.id ?? "");
    setCheckerId("");
    setHasAutoSetChecker(false);
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setItems([
      { productId: "", productCode: "", productName: "", sizeLiter: 5, batchNumber: "", qty: 1, rackRowId: "", levelNumber: "" },
    ]);
    setSaveError("");
    setSaveSuccess(false);
  };

  // ── Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) { setSaveError("Please select a customer."); return; }
    if (items.some((it) => !it.productId || !it.rackRowId || it.levelNumber === "")) {
      setSaveError("Please select a product, location (row), and tier for each line item.");
      return;
    }
    setSaveError("");
    setSaving(true);

    try {
      const finalCheckerId = checkerId || (session?.user as any)?.id || null;
      const res = await fetch("/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, checkerId: finalCheckerId, receivedDate, notes, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save.");

      setSaveSuccess(true);
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        startTransition(() => router.refresh());
      }, 1200);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Undo
  const handleUndo = async (receiptId: string) => {
    if (!confirm("Are you sure you want to undo this Inbound Receipt? The stock will be removed from the warehouse.")) return;
    
    setUndoTargetId(receiptId);
    setUndoError("");
    setUndoSuccess(false);

    try {
      const res = await fetch(`/api/inbound/${receiptId}/undo`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to undo receipt.");

      setUndoSuccess(true);
      alert("Receipt undone successfully.");
      startTransition(() => router.refresh());
    } catch (err: any) {
      setUndoError(err.message);
      alert(err.message);
    } finally {
      setUndoTargetId(null);
    }
  };

  const totalPcs = items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const totalLiter = items.reduce(
    (s, it) => s + Number(it.qty || 0) * Number(it.sizeLiter || 0),
    0
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Table Section ─────────────────────────────────────────────── */}
      <div className="p-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search GRN or Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
            />
          </div>

          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-focus text-white px-4 py-3 sm:py-2 rounded-xl font-medium transition-all shadow-sm shadow-primary/20 w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            New Inbound
          </button>
        </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-100">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
            No inbound receipts found.
          </div>
        ) : filtered.map((receipt) => (
          <div key={receipt.id} className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 ${receipt.isDeleted ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className={`font-bold text-slate-800 text-base ${receipt.isDeleted ? 'line-through text-slate-400' : ''}`}>
                  {receipt.receiptNumber}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(receipt.receivedDate)}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold text-white ${STATUS_COLOR[receipt.status] || 'bg-slate-500'}`}>
                  {STATUS_LABEL[receipt.status] || receipt.status}
                </span>
                {receipt.isDeleted && receipt.requestedBy && (
                  <p className="text-[10px] text-slate-400">by {receipt.requestedBy}</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Customer</p>
                <p className="text-sm font-semibold text-slate-700">{receipt.customer?.name || "-"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Checker</p>
                <p className="text-sm font-medium text-slate-700">{receipt.checker?.fullName || "-"}</p>
              </div>
            </div>
            
            <div className="border-t border-slate-100 pt-3 mt-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Items Received</p>
              {receipt.isDeleted ? (
                <span className="text-slate-400 italic text-xs">—</span>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-700">{receipt.totalPcsReceived} pcs</p>
                  {receipt.outboundedQty > 0 && (
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Outbounded: {receipt.outboundedQty} pcs
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {!receipt.isDeleted && (
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
                {receipt.status !== "discrepancy" && (
                  <button
                    onClick={() => handleUndo(receipt.id)}
                    disabled={undoTargetId === receipt.id}
                    className="flex-1 py-2.5 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors bg-amber-50/50 disabled:opacity-50 flex items-center justify-center border border-amber-100"
                  >
                    {undoTargetId === receipt.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4 mr-1.5" />}
                    <span className="text-xs font-semibold">Undo</span>
                  </button>
                )}
                
                {pendingDeleteIds.has(receipt.id) ? (
                  <span className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center justify-center">
                    <Clock className="w-4 h-4 mr-1.5" /> Pending
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setDeleteTarget(receipt);
                      setDeleteReason("");
                      setDeleteError("");
                      setDeleteSuccess(false);
                    }}
                    className="flex-1 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors bg-red-50/50 flex items-center justify-center border border-red-100"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" /> <span className="text-xs font-semibold">Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
              <tr>
                <th className="px-6 py-4 font-semibold">GRN Number</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold">Received Date</th>
                <th className="px-6 py-4 font-semibold">Pcs Received</th>
                <th className="px-6 py-4 font-semibold">Checker</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No inbound receipts found.
                  </td>
                </tr>
              ) : (
                filtered.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className={`transition-colors ${
                      receipt.isDeleted
                        ? "bg-red-50/60 opacity-70"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-6 py-4 font-medium text-slate-800">
                      <span className={receipt.isDeleted ? "line-through text-slate-400" : ""}>
                        {receipt.receiptNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">{receipt.customer?.name || <span className="text-slate-300 italic text-xs">—</span>}</td>
                    <td className="px-6 py-4">{formatDateTime(receipt.receivedDate)}</td>
                    <td className="px-6 py-4">
                      {receipt.isDeleted ? (
                        <span className="text-slate-400 italic text-xs">—</span>
                      ) : (
                        <div>
                          <div>{receipt.totalPcsReceived} pcs</div>
                          {receipt.outboundedQty > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Outbounded: {receipt.outboundedQty} pcs
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">{receipt.checker?.fullName || <span className="text-slate-300 italic text-xs">—</span>}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                          STATUS_COLOR[receipt.status] || "bg-slate-500"
                        }`}
                      >
                        {STATUS_LABEL[receipt.status] || receipt.status}
                      </span>
                      {receipt.isDeleted && receipt.requestedBy && (
                        <p className="text-[10px] text-slate-400 mt-1">by {receipt.requestedBy}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {receipt.isDeleted ? (
                        <span className="text-[11px] text-slate-400 italic">Data removed</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          {receipt.status !== "discrepancy" && (
                            <button
                              onClick={() => handleUndo(receipt.id)}
                              disabled={undoTargetId === receipt.id}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-100 transition-colors disabled:opacity-50"
                              title="Undo GRN"
                            >
                              {undoTargetId === receipt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                              Undo
                            </button>
                          )}
                          {pendingDeleteIds.has(receipt.id) ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200">
                              <Clock className="w-3 h-3" />
                              Delete Pending
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                setDeleteTarget(receipt);
                                setDeleteReason("");
                                setDeleteError("");
                                setDeleteSuccess(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-3 sm:py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Pengajuan Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ─────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!saving) { setShowModal(false); resetForm(); } }}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-3xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">New Inbound (GRN)</h2>
                  <p className="text-xs text-slate-500">Record incoming goods from customer</p>
                </div>
              </div>
              <button
                onClick={() => { if (!saving) { setShowModal(false); resetForm(); } }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success State */}
            {saveSuccess ? (
              <div className="p-12 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">GRN Created!</h3>
                <p className="text-slate-500 text-sm">Inbound receipt has been saved successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Error banner */}
                {saveError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {saveError}
                  </div>
                )}

                {/* Row 1 — Customer & Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="z-20 relative">
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Customer *
                    </label>
                    <CreatableSelect
                      isDisabled={isCreatingCustomer}
                      isLoading={isCreatingCustomer}
                      options={[...customers, ...additionalCustomers].map(c => ({ value: c.id, label: c.name }))}
                      value={customerId ? { value: customerId, label: [...customers, ...additionalCustomers].find(c => c.id === customerId)?.name } : null}
                      onChange={(val: any) => {
                        setCustomerId(val ? val.value : "");
                      }}
                      onCreateOption={async (inputValue) => {
                        setIsCreatingCustomer(true);
                        setSaveError("");
                        try {
                          const res = await fetch("/api/customers", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: inputValue })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || "Failed to create customer");
                          
                          setAdditionalCustomers(prev => [...prev, data.customer]);
                          setCustomerId(data.customer.id);
                        } catch (err: any) {
                          setSaveError(err.message);
                        } finally {
                          setIsCreatingCustomer(false);
                        }
                      }}
                      placeholder="— Select or type new customer —"
                      formatCreateLabel={(inputValue) => `Create new customer: "${inputValue}"`}
                      className="text-sm"
                      styles={{
                        control: (base) => ({ ...base, borderRadius: "0.75rem", minHeight: "42px", borderColor: "#e2e8f0" })
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Received Date *
                    </label>
                    <input
                      type="date"
                      value={receivedDate}
                      onChange={(e) => setReceivedDate(e.target.value)}
                      required
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Row 2 — Checker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Checker
                  </label>
                  <div className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-100 text-slate-500 font-medium cursor-not-allowed">
                    {session?.user?.name || "—"}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      Items Received *
                    </label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-xs text-primary hover:text-primary-focus font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Line
                    </button>
                  </div>

                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-2 items-start p-4 lg:p-3 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        {/* Product select — col 4 */}
                        <div className="col-span-1 lg:col-span-4">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Product</label>
                          <Select
                            options={productOptions}
                            value={productOptions.find(o => o.value === item.productId) || null}
                            onChange={(val) => handleProductChange(idx, val?.value || "")}
                            placeholder="— Select —"
                            className="text-xs mt-0.5"
                            styles={{
                              control: (base) => ({ ...base, borderRadius: "0.5rem", minHeight: "34px", height: "34px", borderColor: "#e2e8f0" })
                            }}
                          />
                        </div>

                        {/* Location (Rack Row) select — col 3 */}
                        <div className="col-span-1 lg:col-span-3">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Row</label>
                          <Select
                            options={locationOptions}
                            value={locationOptions.find(o => o.value === item.rackRowId) || null}
                            onChange={(val) => handleItemChange(idx, "rackRowId", val?.value || "")}
                            placeholder="— Row —"
                            className="text-xs mt-0.5"
                            styles={{
                              control: (base) => ({ ...base, borderRadius: "0.5rem", minHeight: "34px", height: "34px", borderColor: "#e2e8f0" })
                            }}
                          />
                        </div>

                        {/* Level/Tier select — col 2 */}
                        <div className="col-span-1 lg:col-span-2">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Tier</label>
                          <Select
                            options={getLevelOptions(item.rackRowId)}
                            value={item.levelNumber !== "" ? getLevelOptions(item.rackRowId).find(o => o.value === item.levelNumber) || null : null}
                            onChange={(val) => handleItemChange(idx, "levelNumber", val?.value ?? "")}
                            placeholder={item.rackRowId ? "— Tier —" : "Pilih row dulu"}
                            isDisabled={!item.rackRowId}
                            className="text-xs mt-0.5"
                            styles={{
                              control: (base) => ({ ...base, borderRadius: "0.5rem", minHeight: "34px", height: "34px", borderColor: "#e2e8f0" })
                            }}
                          />
                        </div>

                        {/* Qty — col 2 */}
                        <div className="col-span-1 lg:col-span-2">
                          <label className="text-[10px] font-medium text-slate-400 uppercase">Qty (pcs)</label>
                          <input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) => handleItemChange(idx, "qty", Number(e.target.value))}
                            required
                            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-primary outline-none mt-0.5"
                          />
                        </div>

                        {/* Remove */}
                        <div className="col-span-1 lg:col-span-1 flex items-end pb-1 justify-end lg:justify-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                              title="Remove line"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  {totalPcs > 0 && (
                    <div className="flex gap-4 mt-3 px-3">
                      <span className="text-xs text-slate-500">
                        Total: <strong className="text-slate-800">{totalPcs} pcs</strong>
                      </span>
                      <span className="text-xs text-slate-500">
                        ≈ <strong className="text-slate-800">{totalLiter.toFixed(1)} L</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Any notes about this inbound receipt..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                  />
                </div>

                {/* Footer */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    disabled={saving}
                    className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-focus text-white rounded-xl font-semibold shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Save GRN</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
                  <p className="text-sm font-semibold text-slate-700">{deleteTarget.receiptNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Customer: {deleteTarget.customer?.name}</p>
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
                    placeholder="Explain why this GRN should be deleted..."
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
                            targetModel: "InboundReceipt",
                            targetId: deleteTarget.id,
                            targetLabel: deleteTarget.receiptNumber,
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
    </>
  );
}
