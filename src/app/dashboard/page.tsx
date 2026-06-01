"use client";

import { Package, TrendingUp, Truck, AlertCircle, Clock } from "lucide-react";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();
  
  const kpis = [
    { title: "Total Stock", value: "12,450", unit: "pcs", trend: "+2.1%", icon: Package, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Inbound Today", value: "320", unit: "pcs", trend: "1,600 L", icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Active Deliveries", value: "15", unit: "DOs", trend: "6 on the road", icon: Truck, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { title: "Pending Tickets", value: "8", unit: "DTs", trend: "3 Urgent", icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", alert: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse Overview</h1>
          <p className="text-slate-500 mt-1">Welcome back, {session?.user?.name}</p>
        </div>
        <div className="text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-lg border shadow-sm">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            {kpi.alert && <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 rounded-bl-full -z-10" />}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-500 font-medium text-sm">{kpi.title}</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-slate-800">{kpi.value}</h3>
                  <span className="text-slate-500 text-sm font-medium">{kpi.unit}</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${kpi.bg}`}>
                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className={`text-sm font-medium ${kpi.alert ? 'text-orange-600' : 'text-emerald-600'}`}>
                {kpi.alert && <AlertCircle className="w-4 h-4 inline mr-1" />}
                {kpi.trend}
              </span>
              <span className="text-slate-400 text-sm">vs last week</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-6">Recent Stock Movements</h3>
          <div className="animate-pulse space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-4 items-center">
                <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-50 rounded w-1/4"></div>
                </div>
                <div className="h-4 bg-slate-100 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-6">Warehouse Capacity</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Rack A</span>
                <span className="text-emerald-600 font-medium">82%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '82%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Rack B & C</span>
                <span className="text-orange-500 font-medium">91%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: '91%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-slate-700">Rack D & E</span>
                <span className="text-blue-500 font-medium">45%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
