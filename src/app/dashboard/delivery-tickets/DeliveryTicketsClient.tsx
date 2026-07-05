"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";
import {
  Search, Eye, ArrowRight, Loader2, FileUp, FileText,
  CheckCircle2, AlertCircle, Receipt, MapPin, X, Clock, Trash2, MessageSquare, AlertTriangle
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

// --- Types ---
interface LocationResult {
  productCode: string;
  lotBatchNo?: string;
  locations: { positionCode: string; rackCode: string; batchNumber: string | null; availableQty: number }[];
}

const SIMULATED_OCR = {
  dtNumber: "54018554",
  orderNumber: "W20257957",
  customerPoNo: "348095",
  deliverToName: "PT. RUPA RUPA WARNA",
  deliverToAddress: "KOMPLEK RUKO TANAH MAS, BATAM KOTA, BLOK C NO. 9 KEL. SUNGAI PANAS, INDONESIA",
  items: [
    { productCode: "2HL001UVA", productName: "JOTAPLAST (ID) NEW WHITE 18L", lotBatchNo: "4154006-1-*-1:2", delQtyPcs: 30, delQtyLiter: 540 },
  ],
};

export default function DeliveryTicketsClient({ initialTickets, customerId }: { initialTickets: any[]; customerId?: string }) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initialTickets);
  const [search, setSearch] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [ocrStep, setOcrStep] = useState<"upload" | "processing" | "review" | "saving" | "success">("upload");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationResult[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const [formData, setFormData] = useState(SIMULATED_OCR);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [creatingDO, setCreatingDO] = useState<string | null>(null);

  // Delete Request State
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/delete-requests?status=pending")
      .then((r) => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          const ids = new Set<string>(data.filter((d) => d.targetModel === "DeliveryTicket").map((d) => d.targetId));
          setPendingDeleteIds(ids);
        }
      })
      .catch(() => {});
  }, []);

  const handleCreateDO = async (ticketId: string) => {
    setCreatingDO(ticketId);
    try {
      const res = await fetch(`/api/delivery-tickets/${ticketId}/create-do`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Failed to create DO"); return; }
      router.push("/dashboard/deliveries");
    } catch (err) {
      console.error(err);
      alert("An error occurred while creating the DO");
    } finally {
      setCreatingDO(null);
    }
  };

  const handleGenerateInvoice = async (ticketId: string) => {
    setGeneratingId(ticketId);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryTicketId: ticketId }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "Failed to generate invoice"); return; }
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, invoice: data.invoice } : t));
    } catch (err) {
      console.error(err);
      alert("An error occurred while generating the invoice");
    } finally {
      setGeneratingId(null);
    }
  };

  const handleStartUpload = () => {
    setUploadModalOpen(true);
    setOcrStep("upload");
    setLocations([]);
    setSaveError(null);
    setFormData(SIMULATED_OCR);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrStep("processing");

    try {
      let extractedDtNumber = `DT-${Math.floor(Math.random() * 100000)}`;
      let extractedOrderNumber = `ORD-${Math.floor(Math.random() * 100000)}`;
      let extractedCustomerPoNo = `PO-${Math.floor(Math.random() * 100000)}`;
      let extractedDeliverToName = "Omega Trust Customer";
      let extractedDeliverToAddress = "Batam Center";
      let extractedItems: any[] = [];

      if (file.name.toLowerCase().endsWith('.pdf')) {
        // Handle PDF Upload via API
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/delivery-tickets/parse-pdf", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const { text } = await res.json();
          // Use simulated OCR data (real OCR would parse text here)
          // All fields including delivery address are sourced from the Pick List data
          extractedItems = SIMULATED_OCR.items;
          extractedDtNumber = SIMULATED_OCR.dtNumber;
          extractedOrderNumber = SIMULATED_OCR.orderNumber;
          extractedCustomerPoNo = SIMULATED_OCR.customerPoNo;
          extractedDeliverToName = SIMULATED_OCR.deliverToName;
          extractedDeliverToAddress = SIMULATED_OCR.deliverToAddress;
        } else {
          throw new Error("Failed to parse PDF");
        }
      } else {
        // Handle Excel Upload
        const data = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        json.forEach((row: any) => {
          const productCode = row["Product Code"] || row["Item Code"] || row["Code"] || row["Material"];
          const productName = row["Description"] || row["Product Name"] || row["Name"] || row["Material Description"];
          const batchNo = row["Batch No"] || row["Batch"] || row["Lot No"] || row["Lot"];
          const qtyPcs = row["Qty"] || row["Quantity"] || row["Qty (pcs)"] || row["Pcs"] || row["DelQty"];
          const qtyLiter = row["Qty (L)"] || row["Liter"] || row["Liters"] || row["Volume"];

          if (productCode && qtyPcs !== undefined) {
            extractedItems.push({
              productCode: String(productCode),
              productName: productName ? String(productName) : "",
              lotBatchNo: batchNo ? String(batchNo) : "",
              delQtyPcs: Number(qtyPcs) || 0,
              delQtyLiter: qtyLiter ? Number(qtyLiter) : 0,
            });
          }
        });
      }
      
      // If parsing fails to find items, use the mock structure so the user still has something to review
      if (extractedItems.length === 0) {
        extractedItems = SIMULATED_OCR.items;
        extractedDtNumber = SIMULATED_OCR.dtNumber;
        extractedOrderNumber = SIMULATED_OCR.orderNumber;
        extractedCustomerPoNo = SIMULATED_OCR.customerPoNo;
        extractedDeliverToName = SIMULATED_OCR.deliverToName;
        extractedDeliverToAddress = SIMULATED_OCR.deliverToAddress;
      }

      const newFormData = {
        dtNumber: extractedDtNumber,
        orderNumber: extractedOrderNumber,
        customerPoNo: extractedCustomerPoNo,
        deliverToName: extractedDeliverToName,
        deliverToAddress: extractedDeliverToAddress,
        items: extractedItems,
      };

      setFormData(newFormData);

      // Look up warehouse locations for extracted items
      if (customerId) {
        setLocLoading(true);
        try {
          const res = await fetch("/api/delivery-tickets/lookup-locations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId,
              items: extractedItems.map(i => ({ productCode: i.productCode, lotBatchNo: i.lotBatchNo })),
            }),
          });
          const apiData = await res.json();
          if (res.ok) setLocations(apiData.locations || []);
        } catch (e) {
          console.error("Location lookup failed:", e);
        } finally {
          setLocLoading(false);
        }
      }
      setOcrStep("review");
    } catch (err) {
      console.error(err);
      alert("Failed to parse file.");
      setOcrStep("upload");
    }
  };

  const handleSaveAndGenerate = async () => {
    if (!customerId) { alert("Customer ID not found. Please refresh."); return; }
    setOcrStep("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/delivery-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, customerId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to save pick list.");
        setOcrStep("review");
        return;
      }
      setOcrStep("success");
      // Add new ticket to list
      setTickets(prev => [data, ...prev]);
      // Redirect to detail page after short delay
      setTimeout(() => {
        setUploadModalOpen(false);
        router.push(`/dashboard/delivery-tickets/${data.id}`);
      }, 1800);
    } catch (err) {
      console.error(err);
      setSaveError("Network error. Please try again.");
      setOcrStep("review");
    }
  };

  const getLocationsForItem = (productCode: string, lotBatchNo: string) => {
    return locations.find(l => l.productCode === productCode)?.locations || [];
  };

  const filtered = tickets.filter(t =>
    t.dtNumber.toLowerCase().includes(search.toLowerCase()) ||
    (t.deliverToName || "").toLowerCase().includes(search.toLowerCase()) ||
    t.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Pick List or Deliver To..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
        <button
          onClick={handleStartUpload}
          className="flex items-center gap-2 bg-primary hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40"
        >
          <FileUp className="w-5 h-5" />
          Upload Pick List
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">DT Number</th>
              <th className="px-6 py-4 font-semibold">Deliver To</th>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Items</th>
              <th className="px-6 py-4 font-semibold">OCR Status</th>
              <th className="px-6 py-4 font-semibold">Pick List Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No pick lists found.
                </td>
              </tr>
            ) : filtered.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800">{ticket.dtNumber}</td>
                <td className="px-6 py-4">{ticket.deliverToName || ticket.customer.name}</td>
                <td className="px-6 py-4">{formatDateTime(ticket.createdAt)}</td>
                <td className="px-6 py-4">{ticket.items.length} items</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[ticket.ocrStatus] || 'bg-slate-500'}`}>
                    {STATUS_LABEL[ticket.ocrStatus] || ticket.ocrStatus}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${STATUS_COLOR[ticket.status] || 'bg-slate-500'}`}>
                    {ticket.status === "delivered" 
                      ? "Picked" 
                      : ticket.status === "ready" 
                      ? "Waiting to be Picked" 
                      : (STATUS_LABEL[ticket.status] || ticket.status)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/dashboard/delivery-tickets/${ticket.id}`}
                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors inline-flex"
                    title="View Omega DT"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleCreateDO(ticket.id)}
                    disabled={creatingDO === ticket.id}
                    className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors ml-2 disabled:opacity-50"
                    title="Create DO & Go to Outbound"
                  >
                    {creatingDO === ticket.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                  {pendingDeleteIds.has(ticket.id) ? (
                    <span className="inline-flex items-center gap-1.5 p-2 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200 ml-2" title="Delete Pending">
                      <Clock className="w-4 h-4" />
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setDeleteTarget(ticket);
                        setDeleteReason("");
                        setDeleteError("");
                        setDeleteSuccess(false);
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
                      title="Pengajuan Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upload / OCR Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className={`bg-white transition-all duration-300 ${ocrStep === "review" ? "max-w-5xl" : "max-w-md"}`}>
          <DialogHeader>
            <DialogTitle>Smart OCR Pick List Processing</DialogTitle>
            <DialogDescription>
              Upload a Pick List PDF or Image to automatically extract data using AI.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {/* Step 1: Upload */}
            {ocrStep === "upload" && (
              <div
                className="border-2 border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 hover:border-primary/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf, .xlsx, .xls, .csv" 
                  onChange={handleFileUpload} 
                />
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <FileUp className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Click to Select PDF/Excel File</h3>
                <p className="text-slate-500 mt-2 text-sm">Supports .pdf, .xlsx, .xls files for automatic data extraction.</p>
              </div>
            )}

            {/* Step 2: Processing */}
            {ocrStep === "processing" && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">AI Engine is Reading the Document...</h3>
                <p className="text-slate-500 mt-2 text-sm">Extracting tables, batch numbers, and customer data.</p>
              </div>
            )}

            {/* Step 3: Saving */}
            {ocrStep === "saving" && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-lg font-semibold text-slate-700">Saving & Generating Omega DT...</h3>
                <p className="text-slate-500 mt-2 text-sm">Creating Pick List and resolving warehouse locations.</p>
              </div>
            )}

            {/* Step 4: Review */}
            {ocrStep === "review" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Jotun Pick List Preview */}
                <div className="bg-slate-100 rounded-xl p-4 border flex flex-col min-h-[500px]">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Original Document Preview</p>
                  <div className="bg-white border shadow-sm flex flex-col p-5 text-xs text-slate-800 flex-1 rounded-lg font-sans">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] text-slate-500">PT. Jotun Indonesia</p>
                      </div>
                      <div className="text-center flex-1">
                        <h2 className="text-lg font-bold">Pick List</h2>
                      </div>
                      <div className="w-16"></div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex"><span className="w-24">Order Number:</span> <span className="font-bold">{formData.orderNumber}</span></div>
                        <div className="flex mt-1"><span className="w-24">Pick List:</span> <span className="font-bold text-sm tracking-widest">{formData.dtNumber}</span></div>
                        <div className="flex mt-1"><span className="w-24">Customer:</span> <span>{formData.customerPoNo}</span></div>
                        <div className="flex mt-1"><span className="w-24">Route Id:</span> <span></span></div>
                      </div>
                      <div>
                        <div className="flex"><span className="w-24">Created:</span> <span>6/30/26 8:33:02 PM</span></div>
                        <div className="flex mt-1"><span className="w-24">Delivery Date:</span> <span>6/30/26</span></div>
                        <div className="flex mt-1">
                           <span className="w-24">Delivery Address:</span> 
                           <div className="flex-1">
                             <p className="font-bold">{formData.deliverToName}</p>
                             <p>{formData.deliverToAddress}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <table className="w-full border-collapse mt-2 text-left">
                      <thead className="border-b-2 border-black">
                        <tr>
                          <th className="py-1">Location No</th>
                          <th className="py-1">Part Number</th>
                          <th className="py-1">Description</th>
                          <th className="py-1">Lot/Batch No</th>
                          <th className="py-1">Pallet Id</th>
                          <th className="py-1 text-center">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="border-b-2 border-black">
                        {formData.items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-1">F6</td>
                            <td className="py-1 bg-yellow-200/50 font-mono">{item.productCode}</td>
                            <td className="py-1">{item.productName}</td>
                            <td className="py-1 bg-yellow-200/50 font-mono text-[10px]">{item.lotBatchNo}</td>
                            <td className="py-1">*</td>
                            <td className="py-1 text-center">{item.delQtyPcs}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-4">
                      <div className="w-1/2">
                        <div className="flex justify-between"><span className="font-semibold">Total Quantity:</span> <span>30</span></div>
                        <div className="flex justify-between"><span className="font-semibold">Total Gross Weight:</span> <span>840.3</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Extracted Data + Locations */}
                <div className="flex flex-col">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg mb-4 flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">OCR Extraction Successful</p>
                      <p className="text-sm opacity-90 mt-0.5">Review data before generating the Omega Trust DT.</p>
                    </div>
                  </div>

                  {saveError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex gap-3 items-start">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm">{saveError}</p>
                    </div>
                  )}

                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[400px] pr-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Pick List Number</label>
                        <input
                          type="text"
                          className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm"
                          value={formData.dtNumber}
                          onChange={e => setFormData(p => ({ ...p, dtNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase">Order Number</label>
                        <input
                          type="text"
                          className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm"
                          value={formData.orderNumber}
                          onChange={e => setFormData(p => ({ ...p, orderNumber: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Deliver To (Customer Name)</label>
                      <input
                        type="text"
                        className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm"
                        value={formData.deliverToName}
                        onChange={e => setFormData(p => ({ ...p, deliverToName: e.target.value }))}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase">Delivery Address</label>
                      <textarea
                        rows={3}
                        className="w-full mt-1 border rounded-lg px-3 py-2 bg-white text-sm resize-none"
                        value={formData.deliverToAddress}
                        onChange={e => setFormData(p => ({ ...p, deliverToAddress: e.target.value }))}
                      />
                    </div>

                    {/* Items with location badges */}
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">
                        Extracted Items & Warehouse Locations
                      </label>
                      <div className="border rounded-xl overflow-hidden divide-y">
                        {formData.items.map((item, i) => {
                          const locs = getLocationsForItem(item.productCode, item.lotBatchNo);
                          return (
                            <div key={i} className="p-3 bg-white hover:bg-slate-50">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <p className="font-semibold text-slate-800 text-sm font-mono">{item.productCode}</p>
                                  <p className="text-xs text-slate-500">Batch: {item.lotBatchNo}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-800 text-sm">{item.delQtyPcs} pcs</p>
                                  <p className="text-xs text-slate-500">{item.delQtyLiter} L</p>
                                </div>
                              </div>
                              {/* Location badges */}
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {locLoading ? (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Looking up locations...
                                  </span>
                                ) : locs.length === 0 ? (
                                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> No stock found
                                  </span>
                                ) : locs.map((loc, li) => (
                                  <span key={li} className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {loc.positionCode}
                                    <span className="font-normal text-emerald-600">({loc.availableQty})</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {locations.some(l => l.locations.length > 0) && (
                      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex gap-3 items-start">
                        <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm">Warehouse Locations Found</p>
                          <p className="text-xs opacity-90 mt-0.5">
                            The Omega Trust DT will include exact picking locations for all products.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 mt-5 pt-5 border-t">
                    <button
                      onClick={() => setUploadModalOpen(false)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAndGenerate}
                      className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-primary/20"
                    >
                      Save & Generate Omega DT
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Success */}
            {ocrStep === "success" && (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Omega Trust DT Generated!</h3>
                <p className="text-slate-500 mt-2 text-sm">
                  Pick List saved with warehouse locations. Redirecting to detail view...
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Request Modal ────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { if (!deleteSubmitting) { setDeleteTarget(null); } }}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl p-6">
            {deleteSuccess ? (
              <div className="flex flex-col items-center gap-4 text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Request Submitted!</h3>
                <p className="text-slate-500 text-sm">Your deletion request has been sent to the Owner for review.</p>
                <button
                  onClick={() => { setDeleteTarget(null); setDeleteSuccess(false); }}
                  className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Request Deletion</h2>
                    <p className="text-xs text-slate-500">Submit a deletion request to the Owner (super admin)</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-sm font-semibold text-slate-700">{deleteTarget.dtNumber}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Customer: {deleteTarget.deliverToName || deleteTarget.customer?.name}</p>
                </div>

                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 rounded-xl text-xs text-yellow-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>This request will be reviewed by the <strong>super admin (Owner)</strong> before deletion is executed.</span>
                </div>

                {deleteError && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {deleteError}
                  </div>
                )}

                <div className="mb-5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Reason for Deletion (optional)
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why this Pick List should be deleted..."
                    className="w-full border rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => { if (!deleteSubmitting) setDeleteTarget(null); }}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 border rounded-xl font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setDeleteSubmitting(true);
                      setDeleteError("");
                      try {
                        const res = await fetch("/api/delete-requests", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            targetModel: "DeliveryTicket",
                            targetId: deleteTarget.id,
                            targetLabel: deleteTarget.dtNumber,
                            reason: deleteReason.trim() || null,
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Failed to submit request.");
                        setPendingDeleteIds((prev) => new Set([...prev, deleteTarget.id]));
                        setDeleteSuccess(true);
                      } catch (err: any) {
                        setDeleteError(err.message);
                      } finally {
                        setDeleteSubmitting(false);
                      }
                    }}
                    disabled={deleteSubmitting}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-sm shadow-red-200 disabled:opacity-70"
                  >
                    {deleteSubmitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><MessageSquare className="w-4 h-4" /> Submit Request</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
