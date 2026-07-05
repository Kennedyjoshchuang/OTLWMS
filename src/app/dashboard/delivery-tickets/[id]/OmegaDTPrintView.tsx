"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, Printer } from "lucide-react";

interface Location {
  positionCode: string;
  rackCode: string;
  rackName: string;
  batchNumber: string | null;
  availableQty: number;
  inboundDate: string;
}

interface DTItem {
  id: string;
  lineNo: number | null;
  productCode: string;
  productName: string | null;
  lotBatchNo: string | null;
  delQtyPcs: number;
  delQtyLiter: number | null;
  locations: Location[];
}

interface Ticket {
  id: string;
  dtNumber: string;
  orderNumber: string | null;
  customerPoNo: string | null;
  deliverToName: string | null;
  deliverToAddress: string | null;
  deliveryDate: string | null;
  createdAt: string;
  customer: { id: string; name: string; code: string };
  items: DTItem[];
}

function formatDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar", // WITA (UTC+8)
  });
}

// Generate unique Omega Trust DT number from Jotun DT number
function omegaDtNumber(dtNumber: string) {
  return `OTL-DT-${dtNumber}`;
}

export default function OmegaDTPrintView({
  ticket,
  onClose,
}: {
  ticket: Ticket;
  onClose: () => void;
}) {
  useEffect(() => {
    document.title = `Omega Trust DT - ${ticket.dtNumber}`;
  }, [ticket.dtNumber]);

  const handlePrint = () => window.print();

  const totalPcs = ticket.items.reduce((s, i) => s + i.delQtyPcs, 0);
  const totalLiter = ticket.items.reduce((s, i) => s + (i.delQtyLiter || 0), 0);

  return (
    <>
      {/* Print controls (hidden when printing) */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="font-semibold">Omega Trust DT Preview</span>
          <span className="text-slate-400 text-sm">· {omegaDtNumber(ticket.dtNumber)}</span>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-primary hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-semibold transition-colors shadow-lg shadow-primary/30"
        >
          <Printer className="w-4 h-4" />
          Print / Save as PDF
        </button>
      </div>

      {/* Print Document */}
      <div className="no-print-padding pt-16">
        <div
          id="omega-dt-print"
          className="max-w-4xl mx-auto bg-white p-10 shadow-xl rounded-2xl my-6 print:shadow-none print:rounded-none print:my-0 print:max-w-full"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5 mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {/* Omega Trust branding */}
                <Image
                  src="/logo.png"
                  alt="Omega Trust Logo"
                  width={90}
                  height={90}
                  className="object-contain"
                />
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">OMEGA TRUST</h1>
                  <p className="text-xs text-slate-500">3PL Logistics Management</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Jl. Pondok Indah Raya II No.13, Pemecutan Kaja, Kec. Denpasar Utara, Kota Denpasar, Bali 80111
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">
                Delivery Ticket
              </p>
              <div className="border-2 border-slate-800 px-4 py-2 rounded-xl">
                <p className="text-2xl font-black text-slate-900 font-mono">
                  {omegaDtNumber(ticket.dtNumber)}
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Ref. Jotun DT: <strong>{ticket.dtNumber}</strong>
              </p>
            </div>
          </div>

          {/* Customer & Delivery Info */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Deliver To
              </p>
              <p className="font-bold text-slate-800 text-base">
                {ticket.deliverToName || ticket.customer.name}
              </p>
              {ticket.deliverToAddress && (
                <p className="text-sm text-slate-600 mt-1">{ticket.deliverToAddress}</p>
              )}
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>Customer: <strong>{ticket.customer.name}</strong></span>
                <span>Code: <strong>{ticket.customer.code}</strong></span>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Requested Delivery Date</p>
                  <p className="font-semibold text-slate-800">{formatDate(ticket.deliveryDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Order No</p>
                  <p className="font-semibold text-slate-800">{ticket.orderNumber || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">PO No</p>
                  <p className="font-semibold text-slate-800">{ticket.customerPoNo || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase">Issue Date</p>
                  <p className="font-semibold text-slate-800">{formatDate(ticket.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse text-sm mb-6">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider w-8">
                  No
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Product Code
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Description
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Batch No
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider w-16">
                  Qty (pcs)
                </th>
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider w-16">
                  Qty (L)
                </th>
                <th className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Warehouse Location
                </th>
              </tr>
            </thead>
            <tbody>
              {ticket.items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                  style={{ borderBottom: "1px solid #e2e8f0" }}
                >
                  <td className="px-3 py-3 text-slate-400 text-xs font-mono">
                    {String(idx + 1).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-3 font-mono font-bold text-slate-800 text-xs">
                    {item.productCode}
                  </td>
                  <td className="px-3 py-3 text-slate-700 text-xs leading-relaxed">
                    {item.productName || "-"}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">
                    {item.lotBatchNo || "-"}
                  </td>
                  <td className="px-3 py-3 text-right font-black text-slate-900">
                    {item.delQtyPcs}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600 text-xs">
                    {item.delQtyLiter?.toFixed(1) || "-"}
                  </td>
                  <td className="px-3 py-3">
                    {item.locations.length === 0 ? (
                      <span className="text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        ⚠ Not found in stock
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {item.locations.map((loc, li) => (
                          <div key={li} className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                              {loc.positionCode}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({loc.availableQty} pcs avail)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={4} className="px-3 py-3 text-right text-xs uppercase tracking-wider">
                  TOTAL
                </td>
                <td className="px-3 py-3 text-right font-black">{totalPcs}</td>
                <td className="px-3 py-3 text-right text-xs">{totalLiter.toFixed(1)}</td>
                <td className="px-3 py-3"></td>
              </tr>
            </tfoot>
          </table>

          {/* Signature Section */}
          <div className="grid grid-cols-3 gap-8 mt-10 pt-6 border-t border-slate-200">
            {["Prepared By", "Checked By", "Received By"].map((label) => (
              <div key={label} className="text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-12">
                  {label}
                </p>
                <div className="border-t border-slate-400 pt-2">
                  <p className="text-xs text-slate-400">Name / Date / Stamp</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
            <p>Generated by Omega Trust WMS · {new Date().toLocaleString("id-ID", { timeZone: "Asia/Makassar" })} WITA</p>
            <p>
              This document is system-generated and valid without signature for internal use.
            </p>
          </div>
        </div>
      </div>

      {/* Print-specific CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #omega-dt-print { 
            margin: 0 !important; 
            padding: 20px !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </>
  );
}
