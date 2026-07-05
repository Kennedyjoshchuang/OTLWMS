"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Loader2,
  Droplets,
  Package,
  Layers,
  Truck,
  FileText,
  ToggleLeft,
  ToggleRight,
  Info,
} from "lucide-react";

export interface PricingRate {
  id: string;
  key: string;
  label: string;
  description: string | null;
  unit: string;
  unitPrice: number;
  isActive: boolean;
  updatedAt: string;
}

const RATE_META: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; border: string; accent: string }
> = {
  handling_out: {
    icon: Droplets,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    accent: "bg-cyan-600",
  },
  picking: {
    icon: Package,
    color: "text-violet-600",
    bg: "bg-violet-50",
    border: "border-violet-200",
    accent: "bg-violet-600",
  },
  storage: {
    icon: Layers,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    accent: "bg-amber-600",
  },
  delivery: {
    icon: Truck,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    accent: "bg-emerald-600",
  },
  admin: {
    icon: FileText,
    color: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    accent: "bg-indigo-600",
  },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function RateCard({ rate: initial }: { rate: PricingRate }) {
  const [rate, setRate] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draftPrice, setDraftPrice] = useState(String(initial.unitPrice));
  const [draftLabel, setDraftLabel] = useState(initial.label);
  const [draftDesc, setDraftDesc] = useState(initial.description || "");
  const [draftUnit, setDraftUnit] = useState(initial.unit);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const meta = RATE_META[rate.key] || RATE_META["admin"];
  const Icon = meta.icon;

  const openEdit = () => {
    setDraftPrice(String(rate.unitPrice));
    setDraftLabel(rate.label);
    setDraftDesc(rate.description || "");
    setDraftUnit(rate.unit);
    setFeedback(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setFeedback(null);
  };

  const handleSave = async () => {
    const priceNum = parseFloat(draftPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setFeedback({ type: "error", msg: "Harga harus berupa angka non-negatif." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/pricing/${rate.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: draftLabel,
          description: draftDesc,
          unit: draftUnit,
          unitPrice: priceNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", msg: data.error || "Gagal menyimpan perubahan." });
        return;
      }
      setRate({ ...rate, ...data.rate, updatedAt: data.rate.updatedAt });
      setEditing(false);
      setFeedback({ type: "success", msg: "Tarif berhasil diperbarui." });
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", msg: "Terjadi kesalahan jaringan." });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/pricing/${rate.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rate.isActive }),
      });
      const data = await res.json();
      if (res.ok) {
        setRate((prev) => ({ ...prev, isActive: data.rate.isActive }));
      }
    } catch {
      /* silent */
    } finally {
      setToggling(false);
    }
  };

  return (
    <div
      className={`relative rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
        rate.isActive ? "border-slate-200 shadow-sm" : "border-slate-100 opacity-60"
      }`}
    >
      {/* Accent top bar */}
      <div className={`h-1 w-full ${meta.accent} ${!rate.isActive ? "opacity-30" : ""}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl ${meta.bg} ${meta.border} border`}>
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </span>
            <div>
              {editing ? (
                <input
                  className="text-base font-bold text-slate-800 bg-slate-50 border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400 w-52"
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                />
              ) : (
                <h3 className="text-base font-bold text-slate-800">{rate.label}</h3>
              )}
              <p className="text-xs text-slate-400 mt-0.5">
                Key: <span className="font-mono">{rate.key}</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Active toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`p-2 rounded-lg transition-colors ${
                rate.isActive
                  ? "text-emerald-600 hover:bg-emerald-50"
                  : "text-slate-400 hover:bg-slate-100"
              }`}
              title={rate.isActive ? "Nonaktifkan tarif" : "Aktifkan tarif"}
            >
              {toggling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : rate.isActive ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
            </button>

            {/* Edit / Save / Cancel */}
            {!editing ? (
              <button
                onClick={openEdit}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Edit tarif"
              >
                <Pencil className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Simpan"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Batal"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mt-3">
          {editing ? (
            <input
              className="w-full text-sm text-slate-500 bg-slate-50 border rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-400"
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              placeholder="Deskripsi tarif..."
            />
          ) : (
            <p className="text-sm text-slate-500">{rate.description || "—"}</p>
          )}
        </div>

        {/* Price + Unit row */}
        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Unit Harga
            </label>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-slate-500 font-medium">Rp</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  className="w-40 border rounded-xl bg-slate-50 px-3 py-2 text-lg font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={draftPrice}
                  onChange={(e) => setDraftPrice(e.target.value)}
                />
              </div>
            ) : (
              <span className={`text-2xl font-extrabold ${meta.color}`}>
                {formatCurrency(rate.unitPrice)}
              </span>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
              Satuan
            </label>
            {editing ? (
              <input
                className="w-28 border rounded-xl bg-slate-50 px-2.5 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                value={draftUnit}
                onChange={(e) => setDraftUnit(e.target.value)}
                placeholder="/Liter"
              />
            ) : (
              <span className={`text-base font-semibold px-3 py-1.5 rounded-lg ${meta.bg} ${meta.color}`}>
                {rate.unit}
              </span>
            )}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mt-3 text-xs flex items-center gap-1.5 px-3 py-2 rounded-lg border ${
              feedback.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <Info className="w-3.5 h-3.5 shrink-0" />
            {feedback.msg}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
              rate.isActive
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            }`}
          >
            {rate.isActive ? "Aktif" : "Nonaktif"}
          </span>
          <span className="text-xs text-slate-400">
            Diperbarui:{" "}
            {new Date(rate.updatedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PricingClient({ rates }: { rates: PricingRate[] }) {
  const formatCurrencyTotal = (rates: PricingRate[]) => {
    const active = rates.filter((r) => r.isActive);
    return `${active.length} dari ${rates.length} tarif aktif`;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/invoices"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Billing &amp; Invoices
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Kelola Tarif Layanan</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Atur harga jasa logistik yang digunakan untuk generate invoice secara otomatis.
          </p>
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <span className="text-xs text-slate-400">Status tarif</span>
          <span className="text-sm font-semibold text-slate-700">{formatCurrencyTotal(rates)}</span>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-5 py-4">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-sm text-indigo-800">
          <strong>Perubahan tarif berlaku segera.</strong> Invoice yang sudah diterbitkan tidak akan
          terpengaruh. Hanya invoice baru yang akan menggunakan tarif yang diperbarui.
        </div>
      </div>

      {/* Rate cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {rates.map((rate) => (
          <RateCard key={rate.id} rate={rate} />
        ))}
      </div>
    </div>
  );
}
