"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Truck, MapPin, Clock, CheckCircle2, Loader2, Search,
  Package, RotateCcw, ChevronRight, User, AlertCircle, Send,
} from "lucide-react";
import { formatDateTime, STATUS_COLOR, STATUS_LABEL } from "@/lib/utils";

interface DeliveryOrder {
  id: string;
  doNumber: string;
  status: string;
  destination: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  deliveryTicketId: string;
  customer: { name: string };
  driver: { fullName: string } | null;
  picker: { fullName: string } | null;
  deliveryTicket: {
    dtNumber: string;
    deliverToName: string | null;
    deliverToAddress: string | null;
  } | null;
  pickingItems: { id: string }[];
}

interface Props {
  initialOrders: DeliveryOrder[];
  currentUserId: string;
  currentUserRole: string;
}

export default function DeliveriesClient({ initialOrders, currentUserId, currentUserRole }: Props) {
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const isDriver = currentUserRole === "driver";

  const filtered = orders.filter((o) =>
    o.doNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.deliveryTicket?.deliverToName || "").toLowerCase().includes(search.toLowerCase()) ||
    o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    o.destination.toLowerCase().includes(search.toLowerCase())
  );

  const pickedOrders = filtered.filter((o) => o.status === "delivered");
  const deliveredOrders = filtered.filter((o) => o.status === "on_delivery");

  const handleMarkDelivered = async (orderId: string) => {
    setLoadingId(orderId);
    try {
      const res = await fetch(`/api/delivery-orders/${orderId}/mark-delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal menandai sebagai terkirim.");
        return;
      }

      // Update local state
      const order = orders.find((o) => o.id === orderId);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "on_delivery", shippedAt: new Date().toISOString() }
            : o
        )
      );

      // Auto-generate invoice for the linked Delivery Ticket
      if (order?.deliveryTicketId) {
        try {
          await fetch("/api/invoices/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deliveryTicketId: order.deliveryTicketId }),
          });
          // Silently ignore if invoice already exists (400 is expected)
        } catch {
          // Non-critical — invoice can be generated manually later
        }
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleUndo = async (orderId: string) => {
    setUndoingId(orderId);
    try {
      const res = await fetch(`/api/delivery-orders/${orderId}/undo-delivery`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Gagal membatalkan status delivery.");
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "delivered", shippedAt: null }
            : o
        )
      );
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    } finally {
      setUndoingId(null);
    }
  };

  const OrderCard = ({ order }: { order: DeliveryOrder }) => {
    const isDelivered = order.status === "on_delivery";
    const isPicked = order.status === "delivered";

    return (
      <div
        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
          isDelivered ? "border-emerald-200" : "border-slate-200"
        }`}
      >
        {/* Status stripe */}
        <div className={`h-1 w-full ${isDelivered ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-blue-400 to-indigo-500"}`} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-primary" />
                <span className="font-bold text-slate-800 text-sm">{order.doNumber}</span>
              </div>
              {order.deliveryTicket && (
                <p className="text-xs text-slate-400 font-mono">
                  Pick List #{order.deliveryTicket.dtNumber}
                </p>
              )}
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                isDelivered ? "bg-emerald-500" : "bg-blue-500"
              }`}
            >
              {isDelivered ? "Delivered ✓" : "Picked - Ready"}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-2 mb-5">
            <div className="flex gap-2 items-start">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {order.deliveryTicket?.deliverToName || order.customer.name}
                </p>
                <p className="text-xs text-slate-400 line-clamp-2">{order.destination}</p>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Package className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-600">
                {order.pickingItems.length} item{order.pickingItems.length !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex gap-2 items-center">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-600">
                {order.driver?.fullName || (isDriver ? "You (Driver)" : "Belum ditugaskan")}
              </p>
            </div>

            {order.shippedAt && (
              <div className="flex gap-2 items-center">
                <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-600 font-medium">
                  Delivered at {formatDateTime(order.shippedAt)}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t pt-4 flex gap-2">
            <Link
              href={`/dashboard/delivery-orders/${order.id}`}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors"
            >
              Detail <ChevronRight className="w-3.5 h-3.5" />
            </Link>

            {isPicked && (
              <button
                onClick={() => handleMarkDelivered(order.id)}
                disabled={loadingId === order.id}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-xl transition-colors shadow-sm shadow-emerald-500/20"
              >
                {loadingId === order.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Deliver
              </button>
            )}

            {isDelivered && (
              <button
                onClick={() => handleUndo(order.id)}
                disabled={undoingId === order.id}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-orange-600 hover:bg-orange-50 border border-orange-200 disabled:opacity-50 rounded-xl transition-colors"
                title="Undo - Batalkan status Delivered"
              >
                {undoingId === order.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Undo
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Search + Stats bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-6">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search delivery order, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>

        <div className="flex gap-3 text-sm">
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium">
            <Package className="w-4 h-4" />
            {pickedOrders.length} Ready to Deliver
          </div>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {deliveredOrders.length} Delivered
          </div>
        </div>
      </div>

      {/* Driver notice */}
      {isDriver && pickedOrders.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex gap-3 items-start text-blue-700">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Orders Siap Dikirim</p>
            <p className="text-sm opacity-90 mt-0.5">
              Klik tombol <strong>Deliver</strong> setelah barang berhasil diantarkan ke customer.
              Gunakan tombol <strong>Undo</strong> jika kamu tidak sengaja menekan tombol yang salah.
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          <Truck className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">Tidak ada delivery orders ditemukan.</p>
          <p className="text-sm mt-1">Coba ubah kata kunci pencarian.</p>
        </div>
      )}

      {/* Picked / Ready to Deliver */}
      {pickedOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white px-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              Picked — Ready to Deliver ({pickedOrders.length})
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pickedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* Delivered */}
      {deliveredOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white px-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Delivered ({deliveredOrders.length})
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deliveredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
