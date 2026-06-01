"use client";

import { useState } from "react";
import { Search, UserPlus, Shield, Truck, Package, Inbox, MoreHorizontal, User } from "lucide-react";

export default function EmployeesClient({ initialUsers }: { initialUsers: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = initialUsers.filter(u => 
    u.fullName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
      case "warehouse_admin": return <Shield className="w-5 h-5 text-indigo-500" />;
      case "driver": return <Truck className="w-5 h-5 text-emerald-500" />;
      case "picker": return <Package className="w-5 h-5 text-orange-500" />;
      case "checker_inbound": return <Inbox className="w-5 h-5 text-blue-500" />;
      default: return <User className="w-5 h-5 text-slate-500" />;
    }
  };

  const getRoleLabel = (role: string) => {
    return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search name, email, or role..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-xl bg-slate-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-sm"
          />
        </div>
        <button 
          className="flex items-center gap-2 bg-primary hover:bg-primary-focus text-white px-4 py-2 rounded-xl font-medium transition-all"
        >
          <UserPlus className="w-5 h-5" />
          Add Employee
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-y">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee / User</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">System Access</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  No employees found.
                </td>
              </tr>
            ) : filtered.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                      {user.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{user.fullName}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {getRoleIcon(user.role)}
                    <span className="font-medium text-slate-700">{getRoleLabel(user.role)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {user.role === 'customer_viewer' ? (
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">Read-Only</span>
                  ) : (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">Full Access</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
