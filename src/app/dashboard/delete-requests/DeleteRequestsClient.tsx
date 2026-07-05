"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/utils";
import {
  ShieldCheck, Trash2, XCircle, CheckCircle2, Clock,
  Package, FileText, Receipt, AlertTriangle, Loader2,
  User, MessageSquare, Search, Filter, Users, Truck,
  Archive, ClipboardList
} from "lucide-react";

interface DeleteRequest {
  id: string;
  targetModel: string;
  targetId: string;
  targetLabel: string;
  reason: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  requestedBy: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
}

interface Props {
  initialRequests: DeleteRequest[];
}

const MODEL_ICON: Record<string, React.ReactNode> = {
  InboundReceipt: <Package className="w-4 h-4" />,
  Product: <FileText className="w-4 h-4" />,
  Invoice: <Receipt className="w-4 h-4" />,
  Customer: <Users className="w-4 h-4" />,
  DeliveryTicket: <ClipboardList className="w-4 h-4" />,
  DeliveryOrder: <Truck className="w-4 h-4" />,
  PackingList: <Archive className="w-4 h-4" />,
};

const MODEL_LABEL: Record<string, string> = {
  InboundReceipt: "Inbound GRN",
  Product: "Product",
  Invoice: "Invoice",
  Customer: "Customer",
  DeliveryTicket: "Delivery Ticket",
  DeliveryOrder: "Delivery Order",
  PackingList: "Packing List",
};

const MODEL_COLOR: Record<string, string> = {
  InboundReceipt: "bg-blue-100 text-blue-700",
  Product: "bg-violet-100 text-violet-700",
  Invoice: "bg-amber-100 text-amber-700",
  Customer: "bg-indigo-100 text-indigo-700",
  DeliveryTicket: "bg-cyan-100 text-cyan-700",
  DeliveryOrder: "bg-orange-100 text-orange-700",
  PackingList: "bg-fuchsia-100 text-fuchsia-700",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  approved: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  rejected: "bg-red-100 text-red-700 border border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export default function DeleteRequestsClient({ initialRequests }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [requests, setRequests] = useState<DeleteRequest[]>(initialRequests);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionTarget, setActionTarget] = useState<{ request: DeleteRequest; action: "approve" | "reject" } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = requests.filter((r) => {
    const matchSearch =
      r.targetLabel.toLowerCase().includes(search.toLowerCase()) ||
      r.requestedBy.fullName.toLowerCase().includes(search.toLowerCase()) ||
      MODEL_LABEL[r.targetModel]?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const handleAction = async () => {
    if (!actionTarget) return;
    setProcessing(true);
    setProcessingId(actionTarget.request.id);
    try {
      const res = await fetch(`/api/delete-requests/${actionTarget.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionTarget.action, reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Action failed.");
      } else {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === actionTarget.request.id ? { ...r, status: data.status, reviewNote: data.reviewNote } : r
          )
        );
        setActionTarget(null);
        setReviewNote("");
        startTransition(() => router.refresh());
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setProcessing(false);
      setProcessingId(null);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Owner Page</h1>
            <p className="text-sm text-slate-500">Review and manage deletion requests from all modules</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {pendingCount} deletion request{pendingCount > 1 ? "s" : ""} awaiting your review.
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", count: requests.filter((r) => r.status === "pending").length, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
          { label: "Approved", count: requests.filter((r) => r.status === "approved").length, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
          { label: "Rejected", count: requests.filter((r) => r.status === "rejected").length, color: "text-red-600 bg-red-50 border-red-200" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl border p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.count}</p>
            <p className="text-sm font-medium opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-6 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item label, requester, or type..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Request List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-400 font-medium">No deletion requests found.</p>
          </div>
        ) : (
          filtered.map((req) => (
            <div
              key={req.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${
                req.status === "pending" ? "border-yellow-200 shadow-yellow-50" : "border-slate-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Left: info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {/* Model badge */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${MODEL_COLOR[req.targetModel] || "bg-slate-100 text-slate-600"}`}>
                      {MODEL_ICON[req.targetModel]}
                      {MODEL_LABEL[req.targetModel] || req.targetModel}
                    </span>
                    {/* Status badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[req.status] || ""}`}>
                      {STATUS_LABEL[req.status] || req.status}
                    </span>
                  </div>

                  {/* Target label */}
                  <p className="text-lg font-bold text-slate-800 truncate mb-1">{req.targetLabel}</p>

                  {/* Requester */}
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mb-1">
                    <User className="w-3.5 h-3.5" />
                    <span>
                      <span className="font-medium text-slate-700">{req.requestedBy.fullName}</span>
                      {" "}({req.requestedBy.role.replace("_", " ")})
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>{formatDateTime(req.createdAt)}</span>
                  </div>

                  {/* Reason */}
                  {req.reason && (
                    <div className="flex items-start gap-1.5 text-sm text-slate-500 mt-1">
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span className="italic">"{req.reason}"</span>
                    </div>
                  )}

                  {/* Review note */}
                  {req.reviewNote && (
                    <div className="mt-2 px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-500 border border-slate-100">
                      <span className="font-semibold">Review note:</span> {req.reviewNote}
                    </div>
                  )}
                </div>

                {/* Right: action buttons (only for pending) */}
                {req.status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setActionTarget({ request: req, action: "reject" }); setReviewNote(""); }}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                    <button
                      onClick={() => { setActionTarget({ request: req, action: "approve" }); setReviewNote(""); }}
                      disabled={processingId === req.id}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200 disabled:opacity-50"
                    >
                      {processingId === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Approve &amp; Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirm Action Modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!processing) { setActionTarget(null); setReviewNote(""); } }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                actionTarget.action === "approve" ? "bg-red-100" : "bg-slate-100"
              }`}>
                {actionTarget.action === "approve"
                  ? <Trash2 className="w-5 h-5 text-red-600" />
                  : <XCircle className="w-5 h-5 text-slate-600" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {actionTarget.action === "approve" ? "Confirm Deletion" : "Reject Request"}
                </h2>
                <p className="text-xs text-slate-500">
                  {actionTarget.action === "approve"
                    ? "This will permanently delete the record."
                    : "The requester will be notified that this request was rejected."}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-sm">
              <p className="font-medium text-slate-700">{actionTarget.request.targetLabel}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {MODEL_LABEL[actionTarget.request.targetModel]} — requested by {actionTarget.request.requestedBy.fullName}
              </p>
            </div>

            {actionTarget.action === "approve" && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This action <strong>cannot be undone</strong>. All associated data will also be deleted.</span>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                Review Note (optional)
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                placeholder="Add a note about this decision..."
                className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { if (!processing) { setActionTarget(null); setReviewNote(""); } }}
                disabled={processing}
                className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processing}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-70 ${
                  actionTarget.action === "approve"
                    ? "bg-red-500 hover:bg-red-600 shadow-red-200"
                    : "bg-slate-700 hover:bg-slate-800 shadow-slate-200"
                }`}
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : actionTarget.action === "approve" ? (
                  <><CheckCircle2 className="w-4 h-4" /> Confirm Delete</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Reject Request</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
