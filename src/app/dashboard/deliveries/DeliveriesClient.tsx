"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Truck, MapPin, Clock, CheckCircle2, Loader2, Search,
  Package, RotateCcw, ChevronRight, User, AlertCircle, Send,
  UserCheck, AlertTriangle
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DriverUser {
  id: string;
  fullName: string;
  role: string;
}

interface DeliveryOrder {
  id: string;
  doNumber: string;
  status: string;
  destination: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  deliveryTicketId: string;
  driverId?: string | null;
  vehicleNo?: string | null;
  helperName?: string | null;
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
  drivers?: DriverUser[];
  currentUserId: string;
  currentUserRole: string;
}

export default function DeliveriesClient({
  initialOrders,
  drivers = [],
  currentUserId,
  currentUserRole,
}: Props) {
  const { t, language } = useLanguage();
  const [orders, setOrders] = useState<DeliveryOrder[]>(initialOrders);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  // Fleet modal state ("Assign Fleet")
  const [fleetOrder, setFleetOrder] = useState<DeliveryOrder | null>(null);
  const [fleetDriverId, setFleetDriverId] = useState("");
  const [fleetVehicleNo, setFleetVehicleNo] = useState("");
  const [fleetHelperName, setFleetHelperName] = useState("");
  const [fleetSaving, setFleetSaving] = useState(false);

  // Warning modal state
  const [warningOrder, setWarningOrder] = useState<DeliveryOrder | null>(null);

  const isDriver = currentUserRole === "driver";

  const filtered = orders.filter(
    (o) =>
      o.doNumber.toLowerCase().includes(search.toLowerCase()) ||
      (o.deliveryTicket?.deliverToName || "").toLowerCase().includes(search.toLowerCase()) ||
      o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      o.destination.toLowerCase().includes(search.toLowerCase()) ||
      (o.vehicleNo || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.helperName || "").toLowerCase().includes(search.toLowerCase())
  );

  const pickedOrders = filtered.filter((o) => o.status === "delivered");
  const deliveredOrders = filtered.filter((o) => o.status === "on_delivery");

  const openFleetModal = (order: DeliveryOrder) => {
    setFleetOrder(order);
    setFleetDriverId(order.driverId || (isDriver ? currentUserId : ""));
    setFleetVehicleNo(order.vehicleNo || "");
    setFleetHelperName(order.helperName || "");
  };

  const closeFleetModal = () => {
    setFleetOrder(null);
    setFleetDriverId("");
    setFleetVehicleNo("");
    setFleetHelperName("");
  };

  const handleSaveFleet = async () => {
    if (!fleetOrder) return;
    setFleetSaving(true);
    try {
      const res = await fetch(`/api/delivery-orders/${fleetOrder.id}/update-fleet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: fleetDriverId || null,
          vehicleNo: fleetVehicleNo || null,
          helperName: fleetHelperName || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update fleet info.");
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === fleetOrder.id ? { ...o, ...data.order } : o))
      );
      closeFleetModal();
    } catch (err) {
      console.error(err);
      alert("Error occurred while saving fleet info.");
    } finally {
      setFleetSaving(false);
    }
  };

  const handleMarkDelivered = async (orderId: string, force = false) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Check if vehicleNo or driver is missing
    const hasDriver = Boolean(order.driverId || order.driver?.fullName);
    const hasVehicle = Boolean(order.vehicleNo && order.vehicleNo.trim() !== "");

    if (!force && (!hasDriver || !hasVehicle)) {
      setWarningOrder(order);
      return;
    }

    setLoadingId(orderId);
    try {
      const res = await fetch(`/api/delivery-orders/${orderId}/mark-delivered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: order.driverId || currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to mark as delivered.");
        return;
      }

      // Update local state
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
        } catch {
          // Non-critical
        }
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setLoadingId(null);
      setWarningOrder(null);
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
        alert(data.error || "Failed to undo delivery status.");
        return;
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "delivered", shippedAt: null } : o
        )
      );
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setUndoingId(null);
    }
  };

  const OrderCard = ({ order }: { order: DeliveryOrder }) => {
    const isDelivered = order.status === "on_delivery";
    const isPicked = order.status === "delivered";

    return (
      <div
        className={`bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
          isDelivered ? "border-emerald-200 dark:border-emerald-900/50" : "border-slate-200 dark:border-zinc-800"
        }`}
      >
        {/* Status stripe */}
        <div
          className={`h-1 w-full ${
            isDelivered
              ? "bg-gradient-to-r from-emerald-400 to-green-500"
              : "bg-gradient-to-r from-blue-400 to-indigo-500"
          }`}
        />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-4 h-4 text-primary" />
                <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{order.doNumber}</span>
              </div>
              {order.deliveryTicket && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 font-mono">
                  Pick List #{order.deliveryTicket.dtNumber}
                </p>
              )}
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${
                isDelivered ? "bg-emerald-500" : "bg-blue-500"
              }`}
            >
              {isDelivered ? `${t('deliveries.delivered')} ✓` : t('deliveries.ready_to_deliver')}
            </span>
          </div>

          {/* Info */}
          <div className="space-y-2 mb-5">
            <div className="flex gap-2 items-start">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
                  {order.deliveryTicket?.deliverToName || order.customer.name}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-400 line-clamp-2">{order.destination}</p>
              </div>
            </div>

            <div className="flex gap-2 items-center">
              <Package className="w-4 h-4 text-slate-400 shrink-0" />
              <p className="text-sm text-slate-600 dark:text-zinc-300">
                {order.pickingItems.length} item{order.pickingItems.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Fleet / Driver details */}
            <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 rounded-xl p-3 space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-400 font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {t('deliveries.modal.driver_label')}:
                </span>
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {order.driver?.fullName || t('deliveries.unassigned')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-400 font-medium flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> {t('deliveries.modal.vehicle_label')}:
                </span>
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {order.vehicleNo || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-zinc-400 font-medium flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" /> {t('deliveries.modal.helper_label')}:
                </span>
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {order.helperName || "-"}
                </span>
              </div>
            </div>

            {order.shippedAt && (
              <div className="flex gap-2 items-center pt-1">
                <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('deliveries.delivered')} at {formatDateTime(order.shippedAt)}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/delivery-orders/${order.id}`}
              className="flex-1 min-w-[70px] flex items-center justify-center gap-1 py-2 px-2.5 text-xs text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl transition-colors font-medium"
            >
              {t('deliveries.detail')} <ChevronRight className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={() => openFleetModal(order)}
              className="flex-1 min-w-[95px] flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl transition-colors"
              title={t('deliveries.assign_fleet')}
            >
              <UserCheck className="w-3.5 h-3.5" />
              {t('deliveries.assign_fleet')}
            </button>

            {isPicked && (
              <button
                onClick={() => handleMarkDelivered(order.id)}
                disabled={loadingId === order.id}
                className="flex-1 min-w-[80px] flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-xl transition-colors shadow-sm shadow-emerald-500/20"
              >
                {loadingId === order.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {t('deliveries.deliver')}
              </button>
            )}

            {isDelivered && (
              <button
                onClick={() => handleUndo(order.id)}
                disabled={undoingId === order.id}
                className="flex items-center justify-center gap-1 py-2 px-2.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-900/50 disabled:opacity-50 rounded-xl transition-colors"
                title="Undo - Cancel Delivered status"
              >
                {undoingId === order.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                {t('deliveries.undo')}
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
            placeholder={t('deliveries.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800/50 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>

        <div className="flex gap-3 text-sm">
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium">
            <Package className="w-4 h-4" />
            {pickedOrders.length} {t('deliveries.ready_to_deliver')}
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {deliveredOrders.length} {t('deliveries.delivered')}
          </div>
        </div>
      </div>

      {/* Driver notice */}
      {isDriver && pickedOrders.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 mb-6 flex gap-3 items-start text-blue-700 dark:text-blue-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">
              {language === 'id' ? "Orders Siap Dikirim" : "Orders Ready to Deliver"}
            </p>
            <p className="text-sm opacity-90 mt-0.5">
              {language === 'id' ? (
                <>Gunakan tombol <strong>Atur Armada</strong> untuk memilih supir, nomor kendaraan, dan kernet. Klik <strong>Deliver</strong> setelah barang diantarkan ke customer.</>
              ) : (
                <>Use the <strong>Assign Fleet</strong> button to attach driver, vehicle number, and helper. Click <strong>Deliver</strong> after goods are delivered to the customer.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-20 text-slate-400 dark:text-zinc-500">
          <Truck className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="font-medium">
            {language === 'id' ? "Tidak ada delivery orders ditemukan." : "No delivery orders found."}
          </p>
          <p className="text-sm mt-1">
            {language === 'id' ? "Coba ubah kata kunci pencarian." : "Try changing your search terms."}
          </p>
        </div>
      )}

      {/* Picked / Ready to Deliver */}
      {pickedOrders.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest bg-white dark:bg-zinc-900 px-3 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-blue-500" />
              Picked — {t('deliveries.ready_to_deliver')} ({pickedOrders.length})
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
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
            <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest bg-white dark:bg-zinc-900 px-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              {t('deliveries.delivered')} ({deliveredOrders.length})
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-800" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deliveredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* Fleet Assignment Modal ("Assign Fleet / Atur Armada") */}
      <Dialog open={Boolean(fleetOrder)} onOpenChange={(open) => !open && closeFleetModal()}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 transition-colors duration-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-zinc-100 text-lg font-bold">
              <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              {t('deliveries.modal.title')}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-zinc-400 text-xs">
              DO: <strong className="font-mono text-slate-700 dark:text-zinc-200">{fleetOrder?.doNumber}</strong> —{" "}
              {fleetOrder?.deliveryTicket?.deliverToName || fleetOrder?.customer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {t('deliveries.modal.driver_label')}
              </label>
              <select
                value={fleetDriverId}
                onChange={(e) => setFleetDriverId(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">{t('deliveries.modal.driver_placeholder')}</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} ({d.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {t('deliveries.modal.vehicle_label')}
              </label>
              <input
                type="text"
                placeholder={t('deliveries.modal.vehicle_placeholder')}
                value={fleetVehicleNo}
                onChange={(e) => setFleetVehicleNo(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                {t('deliveries.modal.helper_label')}
              </label>
              <input
                type="text"
                placeholder={t('deliveries.modal.helper_placeholder')}
                value={fleetHelperName}
                onChange={(e) => setFleetHelperName(e.target.value)}
                className="w-full px-3 py-2 text-sm border dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <button
              onClick={closeFleetModal}
              disabled={fleetSaving}
              className="px-4 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors font-medium"
            >
              {t('deliveries.modal.cancel')}
            </button>
            <button
              onClick={handleSaveFleet}
              disabled={fleetSaving}
              className="flex items-center justify-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {fleetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('deliveries.modal.save')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning Confirmation Modal (Missing Driver / Vehicle No) */}
      <Dialog open={Boolean(warningOrder)} onOpenChange={(open) => !open && setWarningOrder(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-6 transition-colors duration-300">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500 text-lg font-bold">
              <AlertTriangle className="w-5 h-5" />
              {t('deliveries.warning.title')}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-zinc-400 text-sm mt-1">
              {t('deliveries.warning.desc')}{" "}
              <strong className="font-mono text-slate-800 dark:text-zinc-200">{warningOrder?.doNumber}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl p-3.5 text-amber-800 dark:text-amber-300 text-xs space-y-1">
            <p className="font-semibold">
              {language === 'id' ? "Detail saat ini:" : "Current details:"}
            </p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                {t('deliveries.modal.driver_label')}: {warningOrder?.driver?.fullName || <span className="text-red-500 font-bold">{t('deliveries.unassigned')}</span>}
              </li>
              <li>
                {t('deliveries.modal.vehicle_label')}: {warningOrder?.vehicleNo || <span className="text-red-500 font-bold">{t('deliveries.unassigned')}</span>}
              </li>
              <li>
                {t('deliveries.modal.helper_label')}: {warningOrder?.helperName || t('deliveries.unassigned')}
              </li>
            </ul>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <button
              onClick={() => {
                const target = warningOrder;
                setWarningOrder(null);
                if (target) openFleetModal(target);
              }}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/50 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
            >
              {t('deliveries.warning.assign_now')}
            </button>
            <button
              onClick={() => {
                if (warningOrder) handleMarkDelivered(warningOrder.id, true);
              }}
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-colors"
            >
              {t('deliveries.warning.proceed')}
            </button>
            <button
              onClick={() => setWarningOrder(null)}
              className="w-full sm:w-auto px-3 py-2 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {t('deliveries.warning.cancel')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
