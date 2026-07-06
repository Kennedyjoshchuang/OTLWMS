"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Username atau password salah");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const loginAs = (u: string, p = "Admin@123") => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-3xl mx-4 animate-in">
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center gap-6 mb-5">
            <Image src="/logo.png" alt="Omega Logo" width={90} height={90} className="drop-shadow-xl object-contain" />
            <div className="w-[2px] h-16 bg-slate-700/50" />
            <Image src="/jotun-logo.png" alt="Jotun Logo" width={140} height={80} className="drop-shadow-xl object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight text-center leading-tight">Jotun Bali<br />Warehouse Management System</h1>
          <p className="text-slate-300 mt-2 font-medium">Logistics WMS Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
              {error}
            </div>
          )}
          
          {/* Username */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-200 ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="contoh: budi.santoso"
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-200 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-focus text-white rounded-xl font-semibold shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-xs text-slate-400 text-center mb-3 uppercase tracking-wider font-semibold">Demo Accounts</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={() => loginAs('admin')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">admin</button>
            <button onClick={() => loginAs('wh')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">wh</button>
            <button onClick={() => loginAs('checker')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">checker</button>
            <button onClick={() => loginAs('picker')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">picker</button>
            <button onClick={() => loginAs('driver')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">driver</button>
            <button onClick={() => loginAs('jotun@jotun.com')} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700">jotun</button>
          </div>
          <p className="text-[10px] text-slate-500 text-center mt-2">Password semua akun: <span className="font-mono text-slate-400">Admin@123</span></p>
        </div>
      </div>
    </div>
  );
}
