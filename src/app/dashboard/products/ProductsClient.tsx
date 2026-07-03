"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Plus, X, Loader2, CheckCircle2, AlertCircle,
  Pencil, Trash2, Box, ChevronDown, PackageSearch, ToggleLeft, ToggleRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer { id: string; name: string; code: string }

interface Product {
  id: string;
  customerId: string;
  productCode: string;
  productName: string;
  paintType: string | null;
  colorName: string | null;
  colorCode: string | null;
  sizeLiter: number | null;
  weightKg: number | null;
  barcode: string | null;
  unit: string;
  isActive: boolean;
  createdAt: string;
  customer: Customer;
}

interface FormState {
  customerId: string;
  productCode: string;
  productName: string;
  paintType: string;
  colorName: string;
  colorCode: string;
  sizeLiter: string;
  weightKg: string;
  barcode: string;
  unit: string;
}

const EMPTY_FORM: FormState = {
  customerId: "",
  productCode: "",
  productName: "",
  paintType: "",
  colorName: "",
  colorCode: "",
  sizeLiter: "",
  weightKg: "",
  barcode: "",
  unit: "pcs",
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function ProductsClient({
  initialProducts,
  customers,
}: {
  initialProducts: Product[];
  customers: Customer[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Table state
  const [search, setSearch] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // Modal state
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Filtered list
  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchCustomer = filterCustomer ? p.customerId === filterCustomer : true;
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.productCode.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false) ||
        (p.colorName?.toLowerCase().includes(q) ?? false);
      return matchCustomer && matchSearch;
    });
  }, [products, search, filterCustomer]);

  // ── Open add modal
  const openAdd = () => {
    setForm({ ...EMPTY_FORM, customerId: customers[0]?.id ?? "" });
    setEditTarget(null);
    setSaveError("");
    setSaveSuccess(false);
    setModalMode("add");
  };

  // ── Open edit modal
  const openEdit = (p: Product) => {
    setForm({
      customerId: p.customerId,
      productCode: p.productCode,
      productName: p.productName,
      paintType: p.paintType ?? "",
      colorName: p.colorName ?? "",
      colorCode: p.colorCode ?? "",
      sizeLiter: p.sizeLiter !== null ? String(p.sizeLiter) : "",
      weightKg: p.weightKg !== null ? String(p.weightKg) : "",
      barcode: p.barcode ?? "",
      unit: p.unit,
    });
    setEditTarget(p);
    setSaveError("");
    setSaveSuccess(false);
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setEditTarget(null);
    setSaveError("");
    setSaveSuccess(false);
  };

  // ── Submit (add or edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.productCode || !form.productName) {
      setSaveError("Customer, Product Code, dan Product Name wajib diisi.");
      return;
    }
    setSaveError("");
    setSaving(true);

    try {
      let res: Response;
      if (modalMode === "add") {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        res = await fetch(`/api/products/${editTarget!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");

      // Update local state
      if (modalMode === "add") {
        setProducts((prev) => [data, ...prev]);
      } else {
        setProducts((prev) => prev.map((p) => (p.id === data.id ? data : p)));
      }

      setSaveSuccess(true);
      setTimeout(() => {
        closeModal();
        startTransition(() => router.refresh());
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Soft delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Gagal menghapus.");
      }
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      startTransition(() => router.refresh());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ── Form field helper
  const setField = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Paint type suggestions
  const paintTypes = Array.from(new Set(products.map((p) => p.paintType).filter(Boolean)));

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="p-6 border-b bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode, nama, barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
              />
            </div>

            {/* Filter customer */}
            <div className="relative">
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="appearance-none pr-9 pl-3 py-2 border rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats badge */}
          <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full font-medium">
            {filtered.length} of {products.length} products
          </span>

          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white px-4 py-2 rounded-xl font-medium transition-all shadow-sm shadow-primary/20 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-5 py-4 font-semibold">Code</th>
              <th className="px-5 py-4 font-semibold">Product Name</th>
              <th className="px-5 py-4 font-semibold">Customer</th>
              <th className="px-5 py-4 font-semibold">Paint Type</th>
              <th className="px-5 py-4 font-semibold">Color</th>
              <th className="px-5 py-4 font-semibold text-right">Size (L)</th>
              <th className="px-5 py-4 font-semibold text-right">Weight (kg)</th>
              <th className="px-5 py-4 font-semibold">Barcode</th>
              <th className="px-5 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-slate-400">
                  <PackageSearch className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Tidak ada produk ditemukan.</p>
                  <p className="text-xs mt-1 opacity-70">Coba ubah filter atau tambah produk baru.</p>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold">
                      {p.productCode}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800 max-w-[200px]">
                    <div className="truncate" title={p.productName}>{p.productName}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                      {p.customer.code}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs">{p.paintType || "—"}</td>
                  <td className="px-5 py-3.5">
                    {p.colorName ? (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full border border-slate-200 shrink-0"
                          style={{ background: p.colorCode ? `#${p.colorCode}` : "#94a3b8" }}
                        />
                        <span className="text-xs text-slate-600">{p.colorName}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">
                    {p.sizeLiter !== null ? `${p.sizeLiter} L` : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-xs">
                    {p.weightKg !== null ? `${p.weightKg} kg` : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.barcode ? (
                      <span className="font-mono text-[11px] text-slate-500">{p.barcode}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(p)}
                        title="Edit product"
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        title="Nonaktifkan produk"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-xl mx-4 bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-3xl flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Box className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    {modalMode === "add" ? "Tambah Produk Baru" : "Edit Produk"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {modalMode === "add"
                      ? "Produk akan tersedia di dropdown saat buat GRN"
                      : `Editing: ${editTarget?.productCode}`}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success */}
            {saveSuccess ? (
              <div className="p-12 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">
                  {modalMode === "add" ? "Produk Ditambahkan!" : "Produk Diperbarui!"}
                </h3>
                <p className="text-slate-500 text-sm">Data produk berhasil disimpan.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {/* Error */}
                {saveError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {saveError}
                  </div>
                )}

                {/* Customer — only selectable on add */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Customer *
                  </label>
                  {modalMode === "add" ? (
                    <select
                      value={form.customerId}
                      onChange={(e) => setField("customerId", e.target.value)}
                      required
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="">— Pilih customer —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      readOnly
                      value={`${editTarget?.customer.name} (${editTarget?.customer.code})`}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-100 text-slate-500 cursor-not-allowed outline-none"
                    />
                  )}
                </div>

                {/* Code + Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Product Code *
                    </label>
                    <input
                      type="text"
                      value={form.productCode}
                      onChange={(e) => setField("productCode", e.target.value)}
                      required
                      placeholder="e.g. 2W6001FVA"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Unit
                    </label>
                    <select
                      value={form.unit}
                      onChange={(e) => setField("unit", e.target.value)}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      <option value="pcs">pcs</option>
                      <option value="liter">liter</option>
                      <option value="kg">kg</option>
                      <option value="carton">carton</option>
                    </select>
                  </div>
                </div>

                {/* Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={form.productName}
                    onChange={(e) => setField("productName", e.target.value)}
                    required
                    placeholder="e.g. GARDEX PREMIUM GLOSS WHITE"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                {/* Paint Type + Color Name + Color Code */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Paint Type
                    </label>
                    <input
                      type="text"
                      list="paint-types"
                      value={form.paintType}
                      onChange={(e) => setField("paintType", e.target.value)}
                      placeholder="e.g. Premium Gloss"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <datalist id="paint-types">
                      {paintTypes.map((t) => (
                        <option key={t!} value={t!} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Color Name
                    </label>
                    <input
                      type="text"
                      value={form.colorName}
                      onChange={(e) => setField("colorName", e.target.value)}
                      placeholder="e.g. WHITE"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Color Code
                    </label>
                    <input
                      type="text"
                      value={form.colorCode}
                      onChange={(e) => setField("colorCode", e.target.value)}
                      placeholder="e.g. FVA"
                      maxLength={10}
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Size + Weight */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Size (Liter)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.sizeLiter}
                      onChange={(e) => setField("sizeLiter", e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.weightKg}
                      onChange={(e) => setField("weightKg", e.target.value)}
                      placeholder="e.g. 6.0"
                      className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                </div>

                {/* Barcode */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Barcode
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setField("barcode", e.target.value)}
                    placeholder="e.g. 8993510026001"
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                  />
                </div>

                {/* Footer */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={saving}
                    className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-focus text-white rounded-xl font-semibold shadow-sm shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> {modalMode === "add" ? "Simpan Produk" : "Update Produk"}</>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!deleting) setDeleteTarget(null); }}
          />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Nonaktifkan Produk</h3>
                <p className="text-xs text-slate-500">Produk tidak akan muncul di dropdown GRN</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 mb-5">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Produk</p>
              <p className="font-mono text-sm font-bold text-slate-700">{deleteTarget.productCode}</p>
              <p className="text-sm text-slate-600">{deleteTarget.productName}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {deleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Menghapus…</>
                ) : (
                  "Ya, Nonaktifkan"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
