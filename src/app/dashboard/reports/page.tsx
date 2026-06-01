"use client";

import { BarChart3, PieChart, TrendingUp, Download } from "lucide-react";

export default function ReportsPage() {
  const reports = [
    { title: "Stock Aging Report", desc: "View products stored longer than 30 days.", type: "Excel" },
    { title: "Inbound vs Outbound", desc: "Monthly volume comparison.", type: "PDF" },
    { title: "Delivery Performance", desc: "On-time delivery metrics by driver.", type: "Excel" },
    { title: "Location Utilization", desc: "Warehouse space utilization per rack.", type: "PDF" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Generate and export warehouse data.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((r, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border shadow-sm flex justify-between items-center group">
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                {i % 2 === 0 ? <BarChart3 className="w-6 h-6" /> : <PieChart className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">{r.title}</h3>
                <p className="text-sm text-slate-500 mt-1">{r.desc}</p>
              </div>
            </div>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border text-slate-600 rounded-lg text-sm font-medium transition-colors">
              <Download className="w-4 h-4" />
              {r.type}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
