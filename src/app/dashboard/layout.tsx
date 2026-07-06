"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  LayoutDashboard, Package, Inbox, Truck, FileText, 
  Map, Settings, LogOut, Loader2, Menu, Users, Receipt, Box, ShieldCheck
} from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const role = (session.user as any)?.role;

  const navItems = [
    { name: "Inbound (GRN)", href: "/dashboard/inbound", icon: Inbox, roles: ["super_admin", "warehouse_admin", "checker_inbound", "inbound_staff"] },
    { name: "Products", href: "/dashboard/products", icon: Box, roles: ["super_admin", "warehouse_admin", "product_staff"] },
    { name: "Warehouse Map", href: "/dashboard/warehouse", icon: Map, roles: ["super_admin", "warehouse_admin", "checker_inbound", "picker", "warehouse_staff"] },
    { name: "Pick Lists", href: "/dashboard/delivery-tickets", icon: FileText, roles: ["super_admin", "warehouse_admin", "picker", "picklist_staff"] },
    { name: "Billing & Invoices", href: "/dashboard/invoices", icon: Receipt, roles: ["super_admin", "warehouse_admin", "customer_viewer", "billing_staff"] },
    { name: "Outbound", href: "/dashboard/delivery-orders", icon: Package, roles: ["super_admin", "warehouse_admin", "picker", "outbound_staff"] },
    { name: "Deliveries", href: "/dashboard/deliveries", icon: Truck, roles: ["super_admin", "warehouse_admin", "driver", "delivery_staff"] },
    { name: "Employees", href: "/dashboard/employees", icon: Users, roles: ["super_admin", "warehouse_admin", "hr_staff"] },
    { name: "Reports", href: "/dashboard/reports", icon: FileText, roles: ["super_admin", "warehouse_admin", "customer_viewer", "report_staff"] },
    { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["super_admin"] },
    { name: "Owner Page", href: "/dashboard/delete-requests", icon: ShieldCheck, roles: ["super_admin"] },
  ];

  const allowedNav = navItems.filter(item => item.roles.includes(role));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="flex flex-col items-center py-6 px-4 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image src="/logo.png" alt="Omega Logo" width={56} height={56} className="object-contain" />
            <div className="w-[1.5px] h-10 bg-slate-800" />
            <Image src="/jotun-logo.png" alt="Jotun Logo" width={80} height={44} className="object-contain" />
          </div>
          <span className="text-white font-extrabold tracking-wide text-sm text-center leading-tight">
            Jotun Bali<br />Warehouse Management System
          </span>
        </div>
        
        <div className="p-4">
          <div className="mb-6 px-4 py-4 bg-slate-800/50 rounded-xl">
            <p className="text-base font-semibold text-white">{session.user?.name}</p>
            <p className="text-sm text-primary capitalize mt-1">{role.replace('_', ' ')}</p>
          </div>

          <nav className="space-y-1">
            {allowedNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.name} href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-xl transition-colors ${
                    active 
                      ? "bg-primary text-white font-medium shadow-md shadow-primary/20" 
                      : "hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <item.icon className={`w-5 h-5 mr-3 ${active ? 'text-white' : 'text-slate-400'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <button 
            onClick={() => signOut()}
            className="flex items-center w-full px-3 py-2.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 justify-between sticky top-0 z-40">
          <button className="md:hidden p-2 -ml-2 text-slate-500" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="w-6 h-6" />
          </button>
          <div className="font-medium text-slate-800 hidden md:block">
            {allowedNav.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.name || "Dashboard"}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">Jotun Bali Warehouse Management System</span>
          </div>
        </header>

        <div className="p-4 md:p-8 flex-1 overflow-auto bg-slate-50">
          {children}
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
