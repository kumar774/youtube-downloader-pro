"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Youtube, Instagram, Facebook } from "lucide-react";

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "YouTube",
      href: "/",
      icon: Youtube,
      activeColor: "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]",
      hoverColor: "hover:text-red-400 hover:bg-red-500/10",
      active: pathname === "/",
    },
    {
      name: "Instagram",
      href: "/instagram",
      icon: Instagram,
      activeColor: "bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 text-pink-300 border-pink-500/40 shadow-[0_0_15px_rgba(236,72,153,0.3)]",
      hoverColor: "hover:text-pink-400 hover:bg-pink-500/10",
      active: pathname === "/instagram",
    },
    {
      name: "Facebook",
      href: "/facebook",
      icon: Facebook,
      activeColor: "bg-blue-600/25 text-blue-400 border-blue-500/40 shadow-[0_0_15px_rgba(37,99,235,0.3)]",
      hoverColor: "hover:text-blue-400 hover:bg-blue-500/10",
      active: pathname === "/facebook",
    },
  ];

  return (
    <header className="relative z-30 w-full border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Snap<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Save</span>
            <span className="ml-1 text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Pro
            </span>
          </span>
        </Link>

        {/* Central Platform Tabs Navigation */}
        <nav className="flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-black/40 border border-white/10 p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl border transition-all ${
                  item.active
                    ? item.activeColor
                    : `border-transparent text-slate-400 ${item.hoverColor}`
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status Badge */}
        <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>High-Speed Direct</span>
        </div>
      </div>
    </header>
  );
}
