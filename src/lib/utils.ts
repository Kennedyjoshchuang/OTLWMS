import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Makassar', // WITA (UTC+8)
    ...opts,
  })
}

export function formatDateTime(date: Date | string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Makassar', // WITA (UTC+8)
  })
}

export function formatNumber(n: number | null | undefined) {
  if (n == null) return '0'
  return n.toLocaleString('id-ID')
}

export function roundFloat(val: number | null | undefined, decimals: number = 2): number {
  if (val == null || isNaN(val)) return 0
  const factor = Math.pow(10, decimals)
  return Math.round((val + Number.EPSILON) * factor) / factor
}

export function generateGRN(seq: number) {
  const year = new Date().getFullYear()
  return `GRN-${year}-${String(seq).padStart(4, '0')}`
}

export function generateDO(seq: number) {
  const year = new Date().getFullYear()
  return `OTL-PL-${year}-${String(seq).padStart(4, '0')}`
}

export const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-500',
  pending: 'bg-yellow-500',
  verified: 'bg-green-500',
  matched: 'bg-green-500',
  partial: 'bg-orange-500',
  partially_delivered: 'bg-orange-500',
  rejected: 'bg-red-500',
  completed: 'bg-green-600',
  in_progress: 'bg-blue-500',
  outbounded: 'bg-purple-600',
  partially_outbounded: 'bg-indigo-500',
  discrepancy: 'bg-red-500',
  processing: 'bg-blue-400',
  ready: 'bg-cyan-500',
  picking: 'bg-purple-500',
  ready_to_ship: 'bg-indigo-500',
  shipped: 'bg-indigo-600',
  on_delivery: 'bg-green-600',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-600',
  excess: 'bg-orange-400',
  shortage: 'bg-red-400',
  deleted: 'bg-red-700',
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending',
  verified: 'Verified',
  matched: 'Matched',
  partial: 'Partial',
  partially_delivered: 'Partial Delivered',
  rejected: 'Rejected',
  completed: 'Completed',
  in_progress: 'Inbound',
  outbounded: 'Outbounded',
  partially_outbounded: 'Partially Outbounded',
  discrepancy: 'Discrepancy',
  processing: 'Processing',
  ready: 'Waiting to be Picked',
  picking: 'Picking',
  ready_to_ship: 'Ready to Ship',
  shipped: 'Shipped',
  on_delivery: 'Delivered',
  delivered: 'Picked',
  cancelled: 'Cancelled',
  excess: 'Excess',
  shortage: 'Shortage',
  deleted: 'Deleted',
}

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Owner / Super Admin',
  warehouse_admin: 'Warehouse Admin',
  checker_inbound: 'Checker Inbound',
  picker: 'Picker',
  driver: 'Driver',
  customer_viewer: 'Customer Viewer',
  inbound_staff: 'Inbound (GRN)',
  outbound_staff: 'Outbound',
  picklist_staff: 'Pick Lists',
  delivery_staff: 'Deliveries',
  hr_staff: 'Employees',
  product_staff: 'Products',
  billing_staff: 'Billing & Invoices',
  report_staff: 'Reports',
  warehouse_staff: 'Warehouse Map',
  analytics: 'Analytics Staff',
}

export const DEFAULT_ROLE_PAGES: Record<string, string[]> = {
  inbound_staff: ["/dashboard/inbound"],
  outbound_staff: ["/dashboard/delivery-orders"],
  picklist_staff: ["/dashboard/delivery-tickets"],
  delivery_staff: ["/dashboard/deliveries"],
  hr_staff: ["/dashboard/employees"],
  product_staff: ["/dashboard/products"],
  billing_staff: ["/dashboard/invoices"],
  report_staff: ["/dashboard/reports"],
  warehouse_staff: ["/dashboard/warehouse"],
  warehouse_admin: [
    "/dashboard/inbound",
    "/dashboard/products",
    "/dashboard/warehouse",
    "/dashboard/delivery-tickets",
    "/dashboard/invoices",
    "/dashboard/delivery-orders",
    "/dashboard/deliveries",
    "/dashboard/employees",
    "/dashboard/reports",
    "/dashboard/settings",
  ],
  checker_inbound: ["/dashboard/inbound", "/dashboard/warehouse"],
  picker: ["/dashboard/delivery-tickets", "/dashboard/delivery-orders", "/dashboard/warehouse"],
  driver: ["/dashboard/deliveries"],
  customer_viewer: ["/dashboard/delivery-orders", "/dashboard/reports", "/dashboard/invoices"],
  super_admin: [
    "/dashboard/inbound",
    "/dashboard/products",
    "/dashboard/warehouse",
    "/dashboard/delivery-tickets",
    "/dashboard/invoices",
    "/dashboard/delivery-orders",
    "/dashboard/deliveries",
    "/dashboard/employees",
    "/dashboard/analytics",
    "/dashboard/reports",
    "/dashboard/settings",
    "/dashboard/delete-requests",
  ],
  analytics: ["/dashboard/analytics"],
}

export function getPagesForUser(user: { role: string; allowedPages?: string[] | null }) {
  if (user.role === "super_admin") {
    return DEFAULT_ROLE_PAGES.super_admin;
  }
  if (user.allowedPages && user.allowedPages.length > 0) {
    return user.allowedPages;
  }
  return DEFAULT_ROLE_PAGES[user.role] || [];
}

export function hasWriteAccess(user: { role: string; readWritePages?: string[] | null }, pagePath: string): boolean {
  if (user.role === "super_admin") {
    return true;
  }
  if (user.readWritePages && user.readWritePages.length > 0) {
    return user.readWritePages.includes(pagePath);
  }
  if (user.role === "customer_viewer") {
    return false;
  }
  return true;
}

export function getDisplayRowNumber(rackCode: string, dbRowNumber: number): number {
  if (rackCode === "FLOOR") return dbRowNumber;
  if (rackCode === "E") return 17 - dbRowNumber;
  return 15 - dbRowNumber;
}

