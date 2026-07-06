"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ShieldCheck,
  Truck,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentIncident {
  id: string;
  type: string;
  description: string;
  location: string | null;
  reportedAt: string;
}

interface KpiData {
  period: { from: string; to: string };
  zeroIncident: {
    target: number;
    actual: number;
    met: boolean;
    recentIncidents: RecentIncident[];
  };
  otif: {
    target: number;
    actual: number | null;
    totalDelivered: number;
    onTimeCount: number;
    met: boolean | null;
  };
  dtReturn: {
    target: number;
    actual: number | null;
    totalDelivered: number;
    withPod: number;
    met: boolean | null;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | null, suffix = "%") {
  if (val === null) return "N/A";
  return `${val.toFixed(1)}${suffix}`;
}

function StatusBadge({ met }: { met: boolean | null }) {
  if (met === null)
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        <Minus className="w-3 h-3" /> No Data
      </span>
    );
  return met ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3 h-3" /> On Target
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
      <XCircle className="w-3 h-3" /> Below Target
    </span>
  );
}

function GaugeBar({
  value,
  target,
  max = 100,
  invert = false,
}: {
  value: number | null;
  target: number;
  max?: number;
  invert?: boolean;
}) {
  const pct = value === null ? 0 : Math.min((value / max) * 100, 100);
  const targetPct = Math.min((target / max) * 100, 100);
  const onTarget = value !== null && (invert ? value <= target : value >= target);

  return (
    <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-visible mt-3">
      {/* track fill */}
      <div
        className={`h-3 rounded-full transition-all duration-700 ${
          value === null
            ? "bg-slate-200"
            : onTarget
            ? "bg-emerald-500"
            : "bg-red-500"
        }`}
        style={{ width: `${pct}%` }}
      />
      {/* target marker */}
      <div
        className="absolute top-[-4px] w-0.5 h-5 bg-slate-400 rounded-full"
        style={{ left: `${targetPct}%` }}
        title={`Target: ${target}`}
      />
    </div>
  );
}

// ─── Log Incident Modal ───────────────────────────────────────────────────────

function LogIncidentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: "accident", description: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="font-semibold text-slate-800">Log New Incident</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Incident Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="fire">🔥 Fire</option>
              <option value="spillage">💧 Spillage</option>
              <option value="accident">⚠️ Accident</option>
              <option value="other">📋 Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Description *</label>
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of what happened..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Rack A, Loading Bay 2"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? "Saving…" : "Log Incident"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  iconBg,
  title,
  kpiNo,
  targetLabel,
  mainValue,
  mainUnit,
  met,
  barValue,
  barTarget,
  barMax,
  barInvert,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  kpiNo: string;
  targetLabel: string;
  mainValue: string;
  mainUnit?: string;
  met: boolean | null;
  barValue: number | null;
  barTarget: number;
  barMax?: number;
  barInvert?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 flex-1">
        {/* header row */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              KPI {kpiNo}
            </div>
            <StatusBadge met={met} />
          </div>
        </div>
        {/* title + target */}
        <h2 className="font-bold text-slate-800 text-base leading-tight">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{targetLabel}</p>
        {/* main value */}
        <div className="mt-5 flex items-baseline gap-1">
          <span className="text-4xl font-extrabold text-slate-800 tabular-nums">{mainValue}</span>
          {mainUnit && <span className="text-lg font-medium text-slate-400">{mainUnit}</span>}
        </div>
        {/* gauge */}
        <GaugeBar value={barValue} target={barTarget} max={barMax} invert={barInvert} />
        <div className="flex justify-between text-[10px] text-slate-400 mt-1.5">
          <span>0</span>
          <span>Target: {barTarget}{barMax === undefined ? "" : "%"}</span>
          <span>{barMax ?? barTarget}</span>
        </div>
      </div>
      {children && (
        <div className="border-t border-slate-50 bg-slate-50/60 px-6 py-4">{children}</div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // 30 seconds

export default function KpiReportPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchKpi = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/reports/kpi");
      const data = await res.json();
      if (data.success) {
        setKpi(data.kpi);
        setLastUpdated(new Date());
      }
    } catch (_) {
      // silently fail on polling errors
    } finally {
      setLoading(false);
    }
  }, []);

  const resetCountdown = useCallback(() => {
    setCountdown(POLL_INTERVAL_MS / 1000);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? POLL_INTERVAL_MS / 1000 : c - 1));
    }, 1000);
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchKpi();
    resetCountdown();

    timerRef.current = setInterval(() => {
      fetchKpi(true);
      resetCountdown();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [fetchKpi, resetCountdown]);

  function handleManualRefresh() {
    fetchKpi();
    resetCountdown();
  }

  const incidentTypeIcon: Record<string, string> = {
    fire: "🔥",
    spillage: "💧",
    accident: "⚠️",
    other: "📋",
  };

  return (
    <>
      {showModal && (
        <LogIncidentModal
          onClose={() => setShowModal(false)}
          onSaved={() => fetchKpi()}
        />
      )}

      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">KPI Live Dashboard</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Key Performance Indicators — auto-refreshes every 30 seconds
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* live indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Next refresh in {countdown}s
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Log Incident
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* last updated */}
        {lastUpdated && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            Last updated: {lastUpdated.toLocaleTimeString("en-GB")}
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && !kpi && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm h-64 animate-pulse" />
            ))}
          </div>
        )}

        {/* ── KPI Cards ── */}
        {kpi && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* KPI 1 – Zero Incident */}
              <KpiCard
                kpiNo="1"
                icon={<ShieldCheck className="w-6 h-6 text-red-600" />}
                iconBg="bg-red-50"
                title="Zero Incident"
                targetLabel="Target: 0 incidents"
                mainValue={String(kpi.zeroIncident.actual)}
                mainUnit="incident(s)"
                met={kpi.zeroIncident.met}
                barValue={kpi.zeroIncident.actual}
                barTarget={0}
                barMax={Math.max(kpi.zeroIncident.actual, 5)}
                barInvert={true}
              >
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Recent Incidents
                  </p>
                  {kpi.zeroIncident.recentIncidents.length === 0 ? (
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> No incidents recorded
                    </p>
                  ) : (
                    kpi.zeroIncident.recentIncidents.slice(0, 3).map((inc) => (
                      <div key={inc.id} className="flex items-start gap-2 text-xs text-slate-600">
                        <span>{incidentTypeIcon[inc.type] ?? "📋"}</span>
                        <span className="line-clamp-1">{inc.description}</span>
                        <span className="ml-auto text-slate-400 whitespace-nowrap">
                          {new Date(inc.reportedAt).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </KpiCard>

              {/* KPI 2 – OTIF */}
              <KpiCard
                kpiNo="2"
                icon={<Truck className="w-6 h-6 text-blue-600" />}
                iconBg="bg-blue-50"
                title="On Time Delivery (OTIF)"
                targetLabel="Target: ≥ 97% on-time and in-full"
                mainValue={fmt(kpi.otif.actual)}
                met={kpi.otif.met}
                barValue={kpi.otif.actual}
                barTarget={97}
                barMax={100}
              >
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">{kpi.otif.onTimeCount}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">On Time</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">{kpi.otif.totalDelivered}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Total Delivered</p>
                  </div>
                </div>
              </KpiCard>

              {/* KPI 3 – DT Return */}
              <KpiCard
                kpiNo="3"
                icon={<FileCheck2 className="w-6 h-6 text-violet-600" />}
                iconBg="bg-violet-50"
                title="Delivery Ticket (DT) Return"
                targetLabel="Target: 100% signed & stamped POD"
                mainValue={fmt(kpi.dtReturn.actual)}
                met={kpi.dtReturn.met}
                barValue={kpi.dtReturn.actual}
                barTarget={100}
                barMax={100}
              >
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">{kpi.dtReturn.withPod}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">POD Received</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-800 tabular-nums">{kpi.dtReturn.totalDelivered}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Total Delivered</p>
                  </div>
                </div>
              </KpiCard>
            </div>

            {/* ── Summary table ── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 text-sm">KPI Summary Table</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Period:{" "}
                  {new Date(kpi.period.from).toLocaleDateString("en-GB")} –{" "}
                  {new Date(kpi.period.to).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 uppercase tracking-wider bg-slate-50">
                      <th className="text-left px-6 py-3 font-semibold">#</th>
                      <th className="text-left px-6 py-3 font-semibold">KPI</th>
                      <th className="text-left px-6 py-3 font-semibold">Description</th>
                      <th className="text-center px-6 py-3 font-semibold">Target</th>
                      <th className="text-center px-6 py-3 font-semibold">Actual</th>
                      <th className="text-center px-6 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">1</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">Zero Incident</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs">
                        Zero incidents of fire, spillage, and accident
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700">0</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {kpi.zeroIncident.actual}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge met={kpi.zeroIncident.met} />
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">2</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">On Time Delivery (OTIF)</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs">
                        Delivery on time and in full — min. 97%
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700">97%</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {fmt(kpi.otif.actual)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge met={kpi.otif.met} />
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-medium">3</td>
                      <td className="px-6 py-4 font-semibold text-slate-800">DT Return</td>
                      <td className="px-6 py-4 text-slate-500 max-w-xs">
                        Stamped & signed Delivery Tickets submitted within SLA (100%)
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-slate-700">100%</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {fmt(kpi.dtReturn.actual)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge met={kpi.dtReturn.met} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
