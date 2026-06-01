"use client";

import { useState } from "react";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { Search, Package, ArrowRight, PlayCircle } from "lucide-react";

export default function DeliveryOrdersClient({ initialOrders }: { initialOrders: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialOrders.filter(o => 
    o.doNumber.toLowerCase().includes(search.toLowerCase()) || 
    o.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search DO Number or Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">DO Number</th>
              <th className="px-6 py-4 font-semibold">Customer</th>
              <th className="px-6 py-4 font-semibold">Destination</th>
              <th className="px-6 py-4 font-semibold">Picker</th>
              <th className="px-6 py-4 font-semibold">Items</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No delivery orders found.
                </td>
              </tr>
            ) : filtered.map((order) => (
              <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{order.doNumber}</td>
                <td className="px-6 py-4">{order.customer.name}</td>
                <td className="px-6 py-4 max-w-[200px] truncate">{order.destination}</td>
                <td className="px-6 py-4">{order.picker?.fullName || '-'}</td>
                <td className="px-6 py-4">{order.pickingItems.length} items</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[order.status] || 'bg-slate-500'}`}>
                    {STATUS_LABEL[order.status] || order.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Start Picking">
                    <PlayCircle className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors ml-2" title="Details">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
