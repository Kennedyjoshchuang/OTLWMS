"use client";

import { useState } from "react";
import {
  Search, UserPlus, Shield, Truck, Package, Inbox, User, Key,
  X, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Phone, Lock,
  Copy, Check, RefreshCw, LogIn, Trash2, Clock
} from "lucide-react";

// ── Role definitions ────────────────────────────────────────────────────────
const ROLES = [
  { value: "inbound_staff",   label: "Inbound (GRN)",      color: "bg-blue-100 text-blue-700 border-blue-200",     pages: ["Inbound (GRN)"] },
  { value: "outbound_staff",  label: "Outbound",           color: "bg-purple-100 text-purple-700 border-purple-200", pages: ["Outbound"] },
  { value: "picklist_staff",  label: "Pick Lists",         color: "bg-orange-100 text-orange-700 border-orange-200", pages: ["Pick Lists"] },
  { value: "delivery_staff",  label: "Deliveries",         color: "bg-emerald-100 text-emerald-700 border-emerald-200", pages: ["Deliveries"] },
  { value: "hr_staff",        label: "Employees",          color: "bg-pink-100 text-pink-700 border-pink-200",       pages: ["Employees"] },
  { value: "product_staff",   label: "Products",           color: "bg-amber-100 text-amber-700 border-amber-200",    pages: ["Products"] },
  { value: "billing_staff",   label: "Billing & Invoices", color: "bg-cyan-100 text-cyan-700 border-cyan-200",       pages: ["Billing & Invoices"] },
  { value: "report_staff",    label: "Reports",            color: "bg-teal-100 text-teal-700 border-teal-200",       pages: ["Reports"] },
  { value: "warehouse_staff", label: "Warehouse Map",      color: "bg-indigo-100 text-indigo-700 border-indigo-200", pages: ["Warehouse Map"] },
  { value: "warehouse_admin", label: "Warehouse Admin",    color: "bg-slate-100 text-slate-700 border-slate-200",    pages: ["Dashboard", "Inbound", "Products", "Warehouse Map", "Pick Lists", "Billing", "Outbound", "Deliveries", "Employees", "Reports", "Settings"] },
  { value: "checker_inbound", label: "Checker Inbound",    color: "bg-blue-100 text-blue-700 border-blue-200",      pages: ["Inbound (GRN)", "Warehouse Map"] },
  { value: "picker",          label: "Picker",             color: "bg-orange-100 text-orange-700 border-orange-200", pages: ["Pick Lists", "Outbound", "Warehouse Map"] },
  { value: "driver",          label: "Driver",             color: "bg-emerald-100 text-emerald-700 border-emerald-200", pages: ["Deliveries"] },
  { value: "customer_viewer", label: "Customer Viewer",    color: "bg-slate-100 text-slate-700 border-slate-200",    pages: ["Outbound (read-only)", "Reports (read-only)", "Billing (read-only)"] },
  { value: "super_admin",     label: "Owner / Super Admin", color: "bg-rose-100 text-rose-700 border-rose-200",     pages: ["Semua Halaman", "Owner Page", "Settings"] },
];

function getRoleInfo(value: string) {
  return ROLES.find(r => r.value === value) ?? {
    value, label: value, color: "bg-slate-100 text-slate-600 border-slate-200", pages: []
  };
}

function getUsername(email: string) {
  return email?.split("@")[0] ?? email;
}

// ── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ── Credential Card Modal ────────────────────────────────────────────────────
function CredentialModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [showPass, setShowPass] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");
  const roleInfo = getRoleInfo(user.role);
  const username = getUsername(user.email);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) { setResetError("Password minimal 6 karakter."); return; }
    setResetting(true); setResetError("");
    try {
      const res = await fetch(`/api/employees/${user.id}/reset-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Gagal reset password."); }
      setResetSuccess(true);
      setNewPassword("");
    } catch (e: any) {
      setResetError(e.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Kredensial Akun</h2>
              <p className="text-slate-300 text-xs">{user.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Credential Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Info Login</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Username</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-slate-800">{username}</span>
                <CopyButton text={username} />
              </div>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">URL Login</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-slate-600">localhost:3000/login</span>
                <CopyButton text="localhost:3000/login" />
              </div>
            </div>
          </div>

          {/* Page Access */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Halaman yang Dapat Diakses</p>
            <div className="flex flex-wrap gap-1.5">
              {roleInfo.pages.map(p => (
                <span key={p} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${roleInfo.color}`}>{p}</span>
              ))}
            </div>
          </div>

          {/* Reset Password */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Reset Password</p>
            {resetSuccess ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Password berhasil diubah!
              </div>
            ) : (
              <div className="space-y-2">
                {resetError && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {resetError}
                  </p>
                )}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type={showPass ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Password baru"
                      className="w-full pl-8 pr-8 py-2 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60 transition-colors"
                  >
                    {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function EmployeesClient({ initialUsers }: { initialUsers: any[] }) {
  const [users, setUsers]           = useState(initialUsers);
  const [search, setSearch]         = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [credUser, setCredUser]     = useState<any>(null);

  // Add Modal state
  const [modalOpen, setModalOpen]           = useState(false);
  const [form, setForm]                     = useState({ fullName: "", password: "", role: "", phone: "" });
  const [showPassword, setShowPassword]     = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState("");
  const [success, setSuccess]               = useState(false);
  const [createdUsername, setCreatedUsername] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");

  // Delete Request state
  const [userToDelete, setUserToDelete]     = useState<any>(null);
  const [deleteReason, setDeleteReason]     = useState("");
  const [deleting, setDeleting]             = useState(false);
  const [deleteError, setDeleteError]       = useState("");

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = u.fullName.toLowerCase().includes(q) || getUsername(u.email).includes(q) || u.role.toLowerCase().includes(q);
    const matchR = filterRole ? u.role === filterRole : true;
    return matchQ && matchR;
  });

  const openModal = () => {
    setForm({ fullName: "", password: "", role: "", phone: "" });
    setError(""); setSuccess(false); setShowPassword(false);
    setCreatedUsername(""); setCreatedPassword("");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim() || !form.password.trim() || !form.role) {
      setError("Nama, password, dan role wajib diisi."); return;
    }
    if (form.password.length < 6) { setError("Password minimal 6 karakter."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menambahkan employee.");
      setUsers(prev => [data, ...prev]);
      setCreatedUsername(getUsername(data.email));
      setCreatedPassword(form.password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (!deleteReason.trim()) {
      setDeleteError("Alasan penghapusan wajib diisi."); return;
    }
    setDeleting(true); setDeleteError("");
    try {
      const res = await fetch("/api/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetModel: "User",
          targetId: userToDelete.id,
          targetLabel: userToDelete.fullName,
          reason: deleteReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengajukan penghapusan.");
      
      setUsers(users.map(u => 
        u.id === userToDelete.id 
          ? { ...u, deleteRequests: [{ status: "pending" }] }
          : u
      ));
      setUserToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm w-64"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary outline-none text-sm transition-all"
          >
            <option value="">Semua Role</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-primary hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40"
        >
          <UserPlus className="w-5 h-5" />
          Tambah Karyawan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 border rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium">Total Karyawan</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{users.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium">Aktif</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{users.filter(u => u.isActive).length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Role</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{new Set(users.map(u => u.role)).size}</p>
        </div>
      </div>

      {/* Employee Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white border rounded-2xl shadow-sm">
          <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Tidak ada karyawan ditemukan.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b text-slate-500 font-medium">
              <tr>
                <th className="px-5 py-4">Karyawan</th>
                <th className="px-5 py-4">Kredensial</th>
                <th className="px-5 py-4">Akses Halaman</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(user => {
                const roleInfo = getRoleInfo(user.role);
                const username = getUsername(user.email);
                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-emerald-200 flex items-center justify-center font-bold text-primary shrink-0">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-bold leading-tight ${!user.isActive ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                            {user.fullName}
                          </p>
                          <span className={`mt-1 inline-flex text-[10px] font-bold px-2 py-0.5 rounded-md border ${roleInfo.color}`}>
                            {roleInfo.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg w-fit">
                        <span className="text-[10px] uppercase text-slate-400 font-bold mr-1">User:</span>
                        <span className="font-mono font-bold text-slate-700 text-xs">{username}</span>
                        <CopyButton text={username} />
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top max-w-xs">
                      <div className="flex flex-wrap gap-1">
                        {roleInfo.pages.slice(0, 3).map(p => (
                          <span key={p} className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{p}</span>
                        ))}
                        {roleInfo.pages.length > 3 && (
                          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 border border-transparent">+{roleInfo.pages.length - 3} lagi</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top">
                      {user.deleteRequests && user.deleteRequests.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md border border-amber-200 whitespace-nowrap">
                          <Clock className="w-3 h-3" /> Menunggu Hapus
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ${user.isActive ? "text-emerald-700 bg-emerald-100 border border-emerald-200" : "text-red-700 bg-red-100 border border-red-200"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                          {user.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setCredUser(user)}
                          title="Lihat Kredensial & Reset Password"
                          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-primary hover:text-white hover:border-primary transition-all"
                        >
                          <LogIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setUserToDelete(user);
                            setDeleteReason("");
                            setDeleteError("");
                          }}
                          disabled={!user.isActive || (user.deleteRequests && user.deleteRequests.length > 0)}
                          title={!user.isActive ? "Sudah dihapus (nonaktif)" : "Ajukan Hapus Karyawan"}
                          className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Credential Modal */}
      {credUser && <CredentialModal user={credUser} onClose={() => setCredUser(null)} />}

      {/* ── Add Employee Modal ─────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!submitting) setModalOpen(false); }} />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-emerald-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Tambah Karyawan</h2>
                  <p className="text-emerald-100 text-xs">Buat akun sistem baru</p>
                </div>
              </div>
              {!submitting && (
                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="p-6">
              {success ? (
                <div className="flex flex-col items-center gap-4 text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Karyawan Ditambahkan!</h3>
                    <p className="text-slate-500 text-sm mt-1"><strong>{form.fullName}</strong> berhasil ditambahkan.</p>
                  </div>

                  {/* Credentials box */}
                  <div className="w-full bg-slate-900 rounded-2xl p-4 text-left space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Kredensial Login</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Username</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{createdUsername}</span>
                        <CopyButton text={createdUsername} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Password</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{createdPassword}</span>
                        <CopyButton text={createdPassword} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">URL Login</span>
                      <span className="font-mono text-xs text-slate-400">localhost:3000/login</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setModalOpen(false)}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl font-semibold"
                  >
                    Selesai
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Nama Lengkap *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                    </div>
                    {form.fullName.trim() && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Username otomatis: <span className="font-mono font-semibold text-slate-600">{form.fullName.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")}</span>
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">No. Telepon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+62 812 3456 7890"
                        className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Role / Akses Halaman *</label>
                    <select
                      value={form.role}
                      onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2.5 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    >
                      <option value="">— Pilih Role —</option>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    {form.role && (() => {
                      const r = getRoleInfo(form.role);
                      return (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.pages.map(p => (
                            <span key={p} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${r.color}`}>{p}</span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                        placeholder="Min. 6 karakter"
                        className="w-full pl-10 pr-10 py-2.5 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setModalOpen(false)}
                      disabled={submitting}
                      className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex-1 py-2.5 bg-primary hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-70"
                    >
                      {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan…</> : <><UserPlus className="w-4 h-4" /> Tambah Karyawan</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Request Modal ─────────────────────────────────── */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!deleting) setUserToDelete(null); }} />
          <div className="relative z-10 w-full max-w-sm mx-4 bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-1">Ajukan Hapus Karyawan</h3>
              <p className="text-sm text-slate-500 text-center mb-5">
                Anda akan mengajukan penghapusan untuk <strong>{userToDelete.fullName}</strong>. Pengajuan ini butuh persetujuan Owner.
              </p>

              {deleteError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {deleteError}
                </div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Alasan Hapus *</label>
                <textarea
                  value={deleteReason}
                  onChange={e => setDeleteReason(e.target.value)}
                  placeholder="Misal: Resign, dll"
                  className="w-full px-3 py-2 border rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-primary outline-none transition-all resize-none h-20"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={submitDeleteRequest}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajukan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
