import { redirect } from 'next/navigation'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"
export const revalidate = 0

const roleRoutes = [
  { href: "/dashboard/inbound", roles: ["super_admin", "warehouse_admin", "checker_inbound", "inbound_staff"] },
  { href: "/dashboard/products", roles: ["super_admin", "warehouse_admin", "product_staff"] },
  { href: "/dashboard/warehouse", roles: ["super_admin", "warehouse_admin", "checker_inbound", "picker", "warehouse_staff"] },
  { href: "/dashboard/delivery-tickets", roles: ["super_admin", "warehouse_admin", "picker", "picklist_staff"] },
  { href: "/dashboard/invoices", roles: ["super_admin", "warehouse_admin", "customer_viewer", "billing_staff"] },
  { href: "/dashboard/delivery-orders", roles: ["super_admin", "warehouse_admin", "picker", "outbound_staff"] },
  { href: "/dashboard/deliveries", roles: ["super_admin", "warehouse_admin", "driver", "delivery_staff"] },
  { href: "/dashboard/employees", roles: ["super_admin", "warehouse_admin", "hr_staff"] },
  { href: "/dashboard/analytics", roles: ["super_admin", "warehouse_admin", "report_staff"] },
  { href: "/dashboard/reports", roles: ["super_admin", "warehouse_admin", "customer_viewer", "report_staff"] },
  { href: "/dashboard/settings", roles: ["super_admin"] },
  { href: "/dashboard/delete-requests", roles: ["super_admin"] },
];

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const role = (session.user as any)?.role

  const firstAllowedRoute = roleRoutes.find(r => r.roles.includes(role))
  
  if (firstAllowedRoute) {
    redirect(firstAllowedRoute.href)
  } else {
    redirect('/login')
  }
}
