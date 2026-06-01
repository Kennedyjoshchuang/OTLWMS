"use client";

import { useState } from "react";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { Search, Inbox, ArrowRight, Plus } from "lucide-react";

export default function InboundClient({ initialReceipts }: { initialReceipts: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialReceipts.filter(r => 
    r.receiptNumber.toLowerCase().includes(search.toLowerCase()) || 
    r.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search GRN or Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
        <button 
          className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white px-4 py-2 rounded-xl font-medium transition-all"
        >
          <Plus className="w-5 h-5" />
          New Inbound
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">GRN Number</th>
              <th className="px-6 py-4 font-semibold">Customer</th>
              <th className="px-6 py-4 font-semibold">Received Date</th>
              <th className="px-6 py-4 font-semibold">Pcs Received</th>
              <th className="px-6 py-4 font-semibold">Checker</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No inbound receipts found.
                </td>
              </tr>
            ) : filtered.map((receipt) => (
              <tr key={receipt.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{receipt.receiptNumber}</td>
                <td className="px-6 py-4">{receipt.customer.name}</td>
                <td className="px-6 py-4">{formatDateTime(receipt.receivedDate)}</td>
                <td className="px-6 py-4">{receipt.totalPcsReceived} pcs</td>
                <td className="px-6 py-4">{receipt.checker?.fullName || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[receipt.status] || 'bg-slate-500'}`}>
                    {STATUS_LABEL[receipt.status] || receipt.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Verify">
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
