"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "next-themes";
import { DictionaryKey } from "@/lib/i18n/dictionaries";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, Clock, AlertTriangle, Printer, Package, Box, Database, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Period = "daily" | "weekly" | "monthly" | "yearly" | "custom";

interface AnalyticsData {
  summary: {
    inbound: number;
    outbound: number;
    warehouseStock: number;
    deliveredOrders: number;
    pendingDeliveries: number;
    accidents: number;
  };
  chartData: Array<{
    name: string;
    Inbound: number;
    Outbound: number;
  }>;
  details: {
    inbound: Array<{ productCode: string; productName: string; pcs: number; liter: number }>;
    outboundProducts: Array<{ productCode: string; productName: string; pcs: number; liter: number }>;
    outbound: Array<{ id: string; doNumber: string; customerName: string; destination: string; deliveryDate: string; totalPcs: number; totalLiter: number; vehicleNo?: string; driverName?: string; helperName?: string }>;
    pending: Array<{ id: string; doNumber: string; customerName: string; destination: string; status: string; createdAt: string; totalPcs: number; totalLiter: number; vehicleNo?: string; driverName?: string; helperName?: string }>;
    stock: Array<{ productCode: string; productName: string; location: string; pcs: number; liter: number }>;
    employeeDeliveries: Array<{ employeeName: string; driverDestinationsCount: number; helperDestinationsCount: number; totalDestinationsCount: number }>;
  };
}

export default function AnalyticsClient() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({ start: "", end: "" });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Excel export states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSections, setExportSections] = useState({
    inbound: true,
    outboundProducts: true,
    stock: true,
    delivered: true,
    pending: true,
    employeeDeliveries: true
  });

  const handleExcelExport = async () => {
    if (!data) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      let hasData = false;

      if (exportSections.inbound) {
        const inboundRows = data.details.inbound.map(item => ({
          [t('table.col.product_code')]: item.productCode,
          [t('table.col.product_name')]: item.productName,
          [t('table.col.total_pcs')]: item.pcs,
          [t('table.col.total_volume')]: item.liter
        }));
        const ws = XLSX.utils.json_to_sheet(inboundRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.inbound').substring(0, 31));
        hasData = true;
      }

      if (exportSections.outboundProducts) {
        const outboundProdRows = data.details.outboundProducts.map(item => ({
          [t('table.col.product_code')]: item.productCode,
          [t('table.col.product_name')]: item.productName,
          [t('table.col.total_pcs')]: item.pcs,
          [t('table.col.total_volume')]: item.liter
        }));
        const ws = XLSX.utils.json_to_sheet(outboundProdRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.outbound_products').substring(0, 31));
        hasData = true;
      }

      if (exportSections.stock) {
        const stockRows = data.details.stock.map(item => ({
          [t('table.col.product_code')]: item.productCode,
          [t('table.col.product_name')]: item.productName,
          [t('table.col.location')]: item.location,
          [t('table.col.stock_pcs')]: item.pcs,
          [t('table.col.volume')]: item.liter
        }));
        const ws = XLSX.utils.json_to_sheet(stockRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.stock').substring(0, 31));
        hasData = true;
      }

      if (exportSections.delivered) {
        const deliveredRows = data.details.outbound.map(item => ({
          [t('table.col.do_number')]: item.doNumber,
          [t('table.col.customer')]: item.customerName,
          [t('table.col.destination')]: item.destination,
          [t('table.col.date')]: new Date(item.deliveryDate).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US'),
          [t('table.col.total_pcs')]: item.totalPcs,
          [t('table.col.volume')]: item.totalLiter,
          [t('table.col.vehicle_no')]: item.vehicleNo || "-",
          [t('table.col.driver')]: item.driverName || "-",
          [t('table.col.helper')]: item.helperName || "-"
        }));
        const ws = XLSX.utils.json_to_sheet(deliveredRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.delivered').substring(0, 31));
        hasData = true;
      }

      if (exportSections.pending) {
        const pendingRows = data.details.pending.map(item => ({
          [t('table.col.do_number')]: item.doNumber,
          [t('table.col.customer')]: item.customerName,
          [t('table.col.destination')]: item.destination,
          [t('table.col.status')]: item.status.replace(/_/g, ' '),
          [t('table.col.created')]: new Date(item.createdAt).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US'),
          [t('table.col.total_pcs')]: item.totalPcs,
          [t('table.col.volume')]: item.totalLiter,
          [t('table.col.vehicle_no')]: item.vehicleNo || "-",
          [t('table.col.driver')]: item.driverName || "-",
          [t('table.col.helper')]: item.helperName || "-"
        }));
        const ws = XLSX.utils.json_to_sheet(pendingRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.pending').substring(0, 31));
        hasData = true;
      }

      if (exportSections.employeeDeliveries && data.details.employeeDeliveries) {
        const empRows = data.details.employeeDeliveries.map(item => ({
          [t('table.col.employee_name')]: item.employeeName,
          [t('table.col.driver_destinations')]: item.driverDestinationsCount,
          [t('table.col.helper_destinations')]: item.helperDestinationsCount,
          [t('table.col.total_destinations')]: item.totalDestinationsCount,
        }));
        const ws = XLSX.utils.json_to_sheet(empRows);
        XLSX.utils.book_append_sheet(wb, ws, t('analytics.sections.employee_deliveries').substring(0, 31));
        hasData = true;
      }

      if (!hasData) return;

      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute("download", `analytics_report_${period}_${dateStr}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error("Failed to export Excel", err);
    }
  };

  useEffect(() => {
    setMounted(true);
    async function fetchData() {
      setLoading(true);
      try {
        let url = `/api/analytics?period=${period}`;
        if (period === "custom") {
          url += `&start=${customRange.start}&end=${customRange.end}`;
        }
        const res = await fetch(url);
        const result = await res.json();
        if (result.success) {
          setData(result);
        }
      } catch (err) {
        console.error("Failed to fetch analytics", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [period, customRange]);

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          aside, header, .no-print { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; width: 100% !important; background: white !important; color: black !important; }
          body { background: white !important; color: black !important; }
          * { color: black !important; border-color: #e2e8f0 !important; }
          .print-break { page-break-inside: avoid; margin-bottom: 24px; }
          .print-table { border-collapse: collapse; width: 100%; font-size: 12px; }
          .print-table th, .print-table td { border: 1px solid #e2e8f0; padding: 6px; text-align: left; }
          .print-table th { background-color: #f8fafc !important; font-weight: 600; color: #475569 !important; }
          h2 { margin-top: 20px !important; }
        }
      `}</style>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 no-print transition-colors duration-300">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{t('analytics.title')}</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(["daily", "weekly", "monthly", "yearly", "custom"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                period === p 
                  ? "bg-primary text-white shadow-md shadow-primary/20" 
                  : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
              }`}
            >
              {t(`analytics.period.${p}` as DictionaryKey)}
            </button>
          ))}
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 rounded-full text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-md ml-2 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {t('analytics.export_pdf')}
          </button>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-700 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white transition-colors shadow-md flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {t('analytics.export_excel')}
          </button>
        </div>
      </div>

      {period === "custom" && (
        <div className="flex items-end gap-3 mb-8 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 no-print transition-colors duration-300">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">Start Date</label>
            <input 
              type="date" 
              value={customRange.start}
              onChange={(e) => setCustomRange(prev => ({...prev, start: e.target.value}))}
              className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">End Date</label>
            <input 
              type="date" 
              value={customRange.end}
              onChange={(e) => setCustomRange(prev => ({...prev, end: e.target.value}))}
              className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {[
              { label: t('kpi.inbound'), value: `${data?.summary?.inbound?.toLocaleString() || 0} L`, icon: Box, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-500/20" },
              { label: t('kpi.outbound'), value: `${data?.summary?.outbound?.toLocaleString() || 0} L`, icon: Package, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-500/20" },
              { label: t('kpi.warehouse_stock'), value: `${data?.summary?.warehouseStock?.toLocaleString() || 0} L`, icon: Database, color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-500/20" },
              { label: t('kpi.delivered_orders'), value: data?.summary?.deliveredOrders || 0, icon: CheckCircle2, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-500/20" },
              { label: t('kpi.pending_delivery'), value: data?.summary?.pendingDeliveries || 0, icon: Clock, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-500/20" },
              { label: t('kpi.accident'), value: data?.summary?.accidents || 0, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-500/20" },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm flex items-center gap-4 print-break transition-colors duration-300">
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-zinc-300">{stat.label}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-zinc-50 mt-1">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
            <h2 className="text-base font-semibold text-slate-800 dark:text-zinc-100 mb-6">{t('chart.title')}</h2>
            <div className="h-[400px] w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.chartData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#3F3F46' : '#E2E8F0'} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#D4D4D8' : '#64748B', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#D4D4D8' : '#64748B', fontSize: 12 }} />
                    <RechartsTooltip
                      cursor={{ fill: theme === 'dark' ? '#27272A' : '#F1F5F9' }}
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#18181B' : '#FFFFFF',
                        borderColor: theme === 'dark' ? '#3F3F46' : '#E2E8F0',
                        color: theme === 'dark' ? '#F4F4F5' : '#000000',
                        borderRadius: "12px", 
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" 
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px" }} />
                    <Bar dataKey="Inbound" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar dataKey="Outbound" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Detailed Reports */}
          {data?.details && (
            <div className="space-y-8 mt-8">
              {/* Inbound Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.inbound_summary')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_code')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_name')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_pcs')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_volume')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {data.details.inbound.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.inbound')}</td></tr>
                      ) : data.details.inbound.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.productCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.productName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.pcs}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.liter.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Outbound Product Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.outbound_summary')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_code')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_name')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_pcs')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_volume')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {data.details.outboundProducts.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.outbound_prod')}</td></tr>
                      ) : data.details.outboundProducts.map((item, i) => (
                        <tr key={`outprod-${i}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.productCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.productName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.pcs}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.liter.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Warehouse Stock Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.stock_summary')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_code')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.product_name')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.location')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.stock_pcs')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.volume')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {data.details.stock.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.stock')}</td></tr>
                      ) : data.details.stock.map((item, i) => (
                        <tr key={`stock-${i}`} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.productCode}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.productName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 font-medium">{item.location}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.pcs}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.liter.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Delivered Outbound Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.delivered_orders')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.do_number')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.customer')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.destination')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.date')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_pcs')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.volume')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.vehicle_no')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.driver')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.helper')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {data.details.outbound.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.delivered')}</td></tr>
                      ) : data.details.outbound.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.doNumber}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.customerName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 truncate max-w-[200px]" title={item.destination}>{item.destination}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{new Date(item.deliveryDate).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US')}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.totalPcs}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.totalLiter.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 font-medium">{item.vehicleNo || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.driverName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.helperName || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pending Deliveries Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.pending_orders')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.do_number')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.customer')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.destination')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.status')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.created')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_pcs')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.volume')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.vehicle_no')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.driver')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.helper')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {data.details.pending.length === 0 ? (
                        <tr><td colSpan={10} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.pending')}</td></tr>
                      ) : data.details.pending.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.doNumber}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.customerName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 truncate max-w-[200px]" title={item.destination}>{item.destination}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 capitalize">{item.status.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{new Date(item.createdAt).toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US')}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.totalPcs}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.totalLiter.toFixed(1)}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 font-medium">{item.vehicleNo || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.driverName || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300">{item.helperName || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Employee Delivery Performance Table */}
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-700 shadow-sm print-break transition-colors duration-300">
                <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-4">{t('table.employee_deliveries')}</h2>
                <div className="overflow-x-auto">
                  <table className="print-table min-w-full divide-y divide-slate-200 dark:divide-zinc-700">
                    <thead className="bg-slate-50 dark:bg-zinc-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.employee_name')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.driver_destinations')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.helper_destinations')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-zinc-300 uppercase tracking-wider">{t('table.col.total_destinations')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
                      {!data.details.employeeDeliveries || data.details.employeeDeliveries.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-slate-500 dark:text-zinc-400">{t('table.empty.employee_deliveries')}</td></tr>
                      ) : data.details.employeeDeliveries.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800 dark:text-zinc-200 font-medium">{item.employeeName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.driverDestinationsCount}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-zinc-300 text-right">{item.helperDestinationsCount}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-zinc-100 text-right">{item.totalDestinationsCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 transition-colors duration-300">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              {t('analytics.export_modal_title')}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
              {t('analytics.export_modal_desc')}
            </DialogDescription>
          </DialogHeader>

          {/* Quick actions */}
          <div className="flex items-center gap-2 my-2">
            <button
              onClick={() => setExportSections({ inbound: true, outboundProducts: true, stock: true, delivered: true, pending: true, employeeDeliveries: true })}
              className="text-xs font-semibold px-2.5 py-1.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {t('analytics.select_all')}
            </button>
            <button
              onClick={() => setExportSections({ inbound: false, outboundProducts: false, stock: false, delivered: false, pending: false, employeeDeliveries: false })}
              className="text-xs font-semibold px-2.5 py-1.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
            >
              {t('analytics.clear_all')}
            </button>
          </div>

          {/* Checkbox list */}
          <div className="space-y-3 my-4">
            {[
              { key: "inbound" as const, label: t('analytics.sections.inbound') },
              { key: "outboundProducts" as const, label: t('analytics.sections.outbound_products') },
              { key: "stock" as const, label: t('analytics.sections.stock') },
              { key: "delivered" as const, label: t('analytics.sections.delivered') },
              { key: "pending" as const, label: t('analytics.sections.pending') },
              { key: "employeeDeliveries" as const, label: t('analytics.sections.employee_deliveries') },
            ].map((section) => (
              <label
                key={section.key}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-all duration-200"
              >
                <input
                  type="checkbox"
                  checked={exportSections[section.key]}
                  onChange={(e) => setExportSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500/50 cursor-pointer accent-emerald-600"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">
                  {section.label}
                </span>
              </label>
            ))}
          </div>

          <DialogFooter className="flex items-center gap-2 mt-6 justify-end">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              {t('analytics.cancel_btn')}
            </button>
            <button
              onClick={handleExcelExport}
              disabled={!Object.values(exportSections).some(Boolean)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md flex items-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {t('analytics.export_btn')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
