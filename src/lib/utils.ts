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
}
