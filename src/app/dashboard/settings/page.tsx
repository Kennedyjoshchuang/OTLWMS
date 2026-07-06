"use client";

import { User, Shield, Bell, Database } from "lucide-react";

export default function SettingsPage() {
  const sections = [
    { title: "Profile Settings", icon: User, desc: "Update your personal information." },
    { title: "User Management", icon: Shield, desc: "Manage roles and access permissions." },
    { title: "Notifications", icon: Bell, desc: "Configure email and SMS alerts." },
    { title: "System Preferences", icon: Database, desc: "Warehouse locations and global settings." },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">System Settings</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">Configure WMS preferences and users.</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 border shadow-sm flex gap-4 items-start cursor-pointer hover:border-primary/50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">{s.title}</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
