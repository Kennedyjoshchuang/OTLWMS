"use client";

import { Truck, MapPin, CheckCircle, Clock } from "lucide-react";

export default function DeliveriesPage() {
  const deliveries = [
    { id: "DO-2026-0001", customer: "PT. WISCO BANGUNAN INDONESIA", status: "On Delivery", driver: "Sinaga Driver", time: "08:30 AM" },
    { id: "DO-2026-0002", customer: "PT. MAJU BERSAMA", status: "Delivered", driver: "Budi Driver", time: "10:15 AM" },
    { id: "DO-2026-0003", customer: "CV. JAYA ABADI", status: "Pending", driver: "Unassigned", time: "-" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Deliveries Monitoring</h1>
          <p className="text-slate-500 mt-1">Live tracking of outbound shipments.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {deliveries.map(d => (
          <div key={d.id} className="bg-white rounded-2xl p-6 border shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Truck className="w-4 h-4 text-primary" /> {d.id}
              </div>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                d.status === 'On Delivery' ? 'bg-blue-100 text-blue-700' : 
                d.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 
                'bg-slate-100 text-slate-700'
              }`}>
                {d.status}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-sm text-slate-600 line-clamp-2">{d.customer}</p>
              </div>
              <div className="flex gap-3">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <p className="text-sm text-slate-600">{d.time}</p>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t flex justify-between items-center text-sm">
              <span className="text-slate-500">Driver</span>
              <span className="font-medium text-slate-800">{d.driver}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
