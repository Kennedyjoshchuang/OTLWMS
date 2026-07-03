"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Check, Receipt, CreditCard, Calendar, Truck, User, FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface InvoiceItem {
  id: string;
  activityName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  deliveryTicketId: string;
  customerId: string;
  totalAmount: number;
  status: string; // draft | sent | paid | cancelled
  issuedAt: string;
  dueDate: string;
  customer: {
    name: string;
    code: string;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  deliveryTicket: {
    dtNumber: string;
    delnoteNumber: string | null;
    orderNumber: string | null;
    customerPoNo: string | null;
    deliverToName: string | null;
    deliverToAddress: string | null;
    vehicleNo: string | null;
    haulierCompany: string | null;
    totalGrossKg: number | null;
    totalNetKg: number | null;
    totalPcs: number | null;
    totalLiter: number | null;
    totalPallets: number | null;
    deliveryOrders: Array<{
      doNumber: string;
      driver: { fullName: string } | null;
      vehicleNo: string | null;
    }>;
  };
  items: InvoiceItem[];
}

const INVOICE_STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  sent: "bg-blue-50 text-blue-700 border-blue-200",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  cancelled: "Cancelled",
};

export default function InvoiceDetailClient({ invoice: initialInvoice }: { invoice: Invoice }) {
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update status");
        return;
      }
      setInvoice((prev) => ({ ...prev, status: newStatus }));
    } catch (err) {
      console.error(err);
      alert("An error occurred while updating status");
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // 11% VAT / PPN calculation
  const subtotal = invoice.totalAmount;
  const ppn = subtotal * 0.11;
  const grandTotal = subtotal + ppn;

  return (
    <div className="space-y-6">
      {/* Action Bar (Hidden when printing) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <Link
          href="/dashboard/invoices"
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Invoices
        </Link>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>

          {invoice.status !== "paid" && (
            <button
              onClick={() => handleUpdateStatus("paid")}
              disabled={updating}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Mark as Paid
            </button>
          )}

          {invoice.status === "draft" && (
            <button
              onClick={() => handleUpdateStatus("sent")}
              disabled={updating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-md shadow-blue-500/10 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              Mark as Sent
            </button>
          )}

          {invoice.status === "paid" && (
            <button
              onClick={() => handleUpdateStatus("draft")}
              disabled={updating}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            >
              Revert to Draft
            </button>
          )}
        </div>
      </div>

      {/* Invoice Sheet */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 print:my-0">
        
        {/* Printable CSS style wrapper */}
        <style jsx global>{`
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            main, .print\\:hidden, header, aside {
              display: none !important;
            }
            .print\\:block {
              display: block !important;
            }
            .print\\:border-none {
              border: none !important;
            }
            .print\\:shadow-none {
              box-shadow: none !important;
            }
            .print\\:p-0 {
              padding: 0 !important;
            }
            .print-invoice-sheet {
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
          }
        `}</style>

        <div className="print-invoice-sheet space-y-8">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-8 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-wide uppercase">
                <Receipt className="w-8 h-8 text-primary" />
                <span>Omega Trust Logistik</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                Warehouse & Logistics 3PL Provider<br />
                Batamindo Industrial Park, Batam City<br />
                Kepulauan Riau, Indonesia
              </p>
            </div>

            <div className="text-left md:text-right space-y-1">
              <h2 className="text-xs uppercase font-bold tracking-widest text-slate-400">Invoice Number</h2>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{invoice.invoiceNumber}</div>
              <div className="inline-block mt-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${INVOICE_STATUS_COLOR[invoice.status]}`}>
                  {INVOICE_STATUS_LABEL[invoice.status]}
                </span>
              </div>
            </div>
          </div>

          {/* Dates & Client Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50 rounded-2xl p-6 border border-slate-100/50">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill To:</h3>
              <div className="space-y-1">
                <p className="font-extrabold text-slate-800 text-lg leading-tight">{invoice.customer.name}</p>
                <p className="text-xs text-slate-400 font-mono mb-2">Customer Code: {invoice.customer.code}</p>
                {invoice.customer.address && (
                  <p className="text-slate-500 text-sm leading-relaxed max-w-sm">{invoice.customer.address}</p>
                )}
                {invoice.customer.contactName && (
                  <p className="text-slate-500 text-sm pt-2">
                    <span className="font-semibold text-slate-700">Attn:</span> {invoice.customer.contactName}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-4 md:border-l md:pl-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice Details:</h3>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                <span className="text-slate-500">Date Issued:</span>
                <span className="font-medium text-slate-800">{formatDate(invoice.issuedAt)}</span>
                
                <span className="text-slate-500">Due Date:</span>
                <span className="font-medium text-slate-800">{formatDate(invoice.dueDate)}</span>

                <span className="text-slate-500">Payment Term:</span>
                <span className="font-medium text-slate-800">Net 30 Days</span>

                <span className="text-slate-500">Reference DT:</span>
                <span className="font-mono text-xs font-semibold text-slate-800">{invoice.deliveryTicket.dtNumber}</span>
              </div>
            </div>
          </div>

          {/* Delivery Context */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-slate-400" />
              Delivery Context Details
            </h4>
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 uppercase font-medium">Total Volume</div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {invoice.deliveryTicket.totalLiter?.toLocaleString() || 0} L
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 uppercase font-medium">Total Quantity</div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {invoice.deliveryTicket.totalPcs?.toLocaleString() || 0} pcs
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 uppercase font-medium">Total Weight</div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {invoice.deliveryTicket.totalGrossKg?.toLocaleString() || 0} Kg
                </div>
              </div>
              <div className="p-4 text-center">
                <div className="text-xs text-slate-400 uppercase font-medium">Total Pallets</div>
                <div className="text-lg font-bold text-slate-800 mt-1">
                  {invoice.deliveryTicket.totalPallets || 1} Pallet
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-400" />
              Logistics Activity Charges
            </h4>
            <div className="border border-slate-100 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-3">Logistics Activity</th>
                    <th className="px-6 py-3 text-right">Quantity</th>
                    <th className="px-6 py-3 text-right">Rate</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{item.activityName}</div>
                        {item.description && (
                          <div className="text-xs text-slate-400 mt-1">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium">
                        {item.quantity.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-700">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-slate-900">
                        {formatCurrency(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-stretch gap-6 pt-4">
            {/* Payment Details */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 w-full md:max-w-xs text-xs text-slate-500 space-y-3">
              <h5 className="font-bold text-slate-700 uppercase tracking-wider">Payment Instructions</h5>
              <p>Please send payments to the following bank account within 30 days of the invoice issue date:</p>
              <div className="space-y-1 pt-1 font-medium text-slate-700">
                <p>Bank: Bank Mandiri Batam</p>
                <p>Account Name: PT. OMEGA TRUST LOGISTIK</p>
                <p>Account Number: 109-00-1234567-8</p>
              </div>
            </div>

            {/* Calculations */}
            <div className="w-full md:w-80 ml-auto space-y-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pb-3 border-b">
                <span>PPN (11%):</span>
                <span className="font-semibold text-slate-800">{formatCurrency(ppn)}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-slate-900">
                <span>Total Amount Due:</span>
                <span className="text-primary font-black">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Signature Section */}
          <div className="flex justify-between items-end pt-12 text-slate-600 text-xs">
            <div className="space-y-1">
              <p>Prepared by: Admin Finance</p>
              <p className="text-slate-400">Omega Trust Logistik</p>
            </div>
            <div className="text-center space-y-12">
              <p className="border-b pb-12 w-48">Approved Signature</p>
              <p className="font-semibold text-slate-800">Operational Director</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
