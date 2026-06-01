"use client";

import { useState } from "react";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import { Search, Eye, ArrowRight, Loader2, FileUp, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function DeliveryTicketsClient({ initialTickets }: { initialTickets: any[] }) {
  const [search, setSearch] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [ocrStep, setOcrStep] = useState<"upload" | "processing" | "review" | "success">("upload");

  const handleStartUpload = () => {
    setUploadModalOpen(true);
    setOcrStep("upload");
  };

  const simulateOCR = () => {
    setOcrStep("processing");
    setTimeout(() => {
      setOcrStep("review");
    }, 2500);
  };

  const handleConfirmDO = () => {
    setOcrStep("success");
    setTimeout(() => {
      setUploadModalOpen(false);
    }, 2000);
  };

  const filtered = initialTickets.filter(t => 
    t.dtNumber.toLowerCase().includes(search.toLowerCase()) || 
    t.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search DT Number or Customer..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
        <button 
          onClick={handleStartUpload}
          className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40"
        >
          <FileUp className="w-5 h-5" />
          Upload Delivery Ticket
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">DT Number</th>
              <th className="px-6 py-4 font-semibold">Customer</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Items</th>
              <th className="px-6 py-4 font-semibold">OCR Status</th>
              <th className="px-6 py-4 font-semibold">DO Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No delivery tickets found.
                </td>
              </tr>
            ) : filtered.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{ticket.dtNumber}</td>
                <td className="px-6 py-4">{ticket.customer.name}</td>
                <td className="px-6 py-4">{formatDateTime(ticket.createdAt)}</td>
                <td className="px-6 py-4">{ticket.items.length} items</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[ticket.ocrStatus] || 'bg-slate-500'}`}>
                    {STATUS_LABEL[ticket.ocrStatus] || ticket.ocrStatus}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[ticket.status] || 'bg-slate-500'}`}>
                    {STATUS_LABEL[ticket.status] || ticket.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors ml-2" title="Create DO">
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* OCR Simulation Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className={`transition-all duration-300 ${ocrStep === "review" ? "max-w-5xl" : "max-w-md"}`}>
          <DialogHeader>
            <DialogTitle>Smart OCR Ticket Processing</DialogTitle>
            <DialogDescription>
              Upload a Delivery Ticket PDF or Image to automatically extract data using AI.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {ocrStep === "upload" && (
              <div 
                className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={simulateOCR}
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <FileUp className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Click to Select or Drag & Drop</h3>
                <p className="text-slate-500 mt-2 text-sm">Supports PDF, JPG, PNG from Jotun or other customers.</p>
              </div>
            )}

            {ocrStep === "processing" && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">AI Engine is Reading the Document...</h3>
                <p className="text-slate-500 mt-2 text-sm">Extracting tables, batch numbers, and customer data using Google Cloud Vision.</p>
              </div>
            )}

            {ocrStep === "review" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Original Document Preview */}
                <div className="bg-slate-100 rounded-xl p-4 border flex items-center justify-center min-h-[500px]">
                  <div className="w-full h-full bg-white border shadow-sm flex flex-col p-6 text-xs text-slate-800">
                    <div className="flex justify-between border-b pb-4 mb-4">
                      <h2 className="text-lg font-bold">PT. JOTUN INDONESIA</h2>
                      <div className="text-right">
                        <p className="font-bold border px-2">DT NO. 15923331</p>
                      </div>
                    </div>
                    <div className="flex justify-between mb-6">
                      <div className="w-1/2 pr-4">
                        <p className="font-semibold">DELIVER TO:</p>
                        <p>PT. WISCO BANGUNAN INDONESIA</p>
                        <p>INDUSTRI ESTATE BATAM CENTER</p>
                      </div>
                      <div className="w-1/2 border-l pl-4">
                        <p className="font-semibold">ORDER NO: W19682451</p>
                        <p>PO NO: WEBDECO PO/WBI/26/01016</p>
                      </div>
                    </div>
                    <table className="w-full border-collapse border mt-4">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border p-1">Product Code</th>
                          <th className="border p-1">Description</th>
                          <th className="border p-1">Batch No</th>
                          <th className="border p-1">Qty (L)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border p-1 bg-yellow-200/50">2W6001FVA</td>
                          <td className="border p-1">GARDEX PREMIUM GLOSS WHITE 5L</td>
                          <td className="border p-1 bg-yellow-200/50">4112282-1-*-1:2</td>
                          <td className="border p-1 text-right">50.00</td>
                        </tr>
                        <tr>
                          <td className="border p-1 bg-yellow-200/50">2W6001FVA</td>
                          <td className="border p-1">GARDEX PREMIUM GLOSS WHITE 5L</td>
                          <td className="border p-1 bg-yellow-200/50">4184787-1-*-1:2</td>
                          <td className="border p-1 text-right">10.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Side: Extracted Data Validation */}
                <div className="flex flex-col">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-6 flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">OCR Extraction Successful</p>
                      <p className="text-sm opacity-90 mt-1">Please review the extracted data before creating the Delivery Order.</p>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">DT Number</label>
                        <input type="text" className="w-full mt-1 border rounded-lg px-3 py-2 bg-white" defaultValue="15923331" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Order Number</label>
                        <input type="text" className="w-full mt-1 border rounded-lg px-3 py-2 bg-white" defaultValue="W19682451" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Customer (Deliver To)</label>
                      <input type="text" className="w-full mt-1 border rounded-lg px-3 py-2 bg-white" defaultValue="PT. WISCO BANGUNAN INDONESIA" />
                    </div>

                    <div className="pt-4">
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Extracted Items</label>
                      <div className="border rounded-xl overflow-hidden divide-y">
                        <div className="p-3 bg-white flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">2W6001FVA</p>
                            <p className="text-xs text-slate-500">Batch: 4112282-1</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-800 text-sm">10 pcs</p>
                            <p className="text-xs text-slate-500">50 L</p>
                          </div>
                        </div>
                        <div className="p-3 bg-white flex justify-between items-center hover:bg-slate-50">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">2W6001FVA</p>
                            <p className="text-xs text-slate-500">Batch: 4184787-1</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-800 text-sm">2 pcs</p>
                            <p className="text-xs text-slate-500">10 L</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex gap-3 items-start mt-4">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-sm">Auto-Routing Available</p>
                        <p className="text-xs opacity-90 mt-1">System found exact stock matching these batch numbers at Rack A. DO can be dispatched immediately.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-6 border-t">
                    <button 
                      onClick={() => setUploadModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleConfirmDO}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-focus transition-colors shadow-lg shadow-primary/20"
                    >
                      Confirm & Create DO
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ocrStep === "success" && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Delivery Order Created!</h3>
                <p className="text-slate-500 mt-2 text-sm">DO Number: <strong>OTL-DO-2026-0002</strong> has been generated and sent to Pickers.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
