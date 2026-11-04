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
      shortName: "YT",
      mediumName: "YouTube",
      href: "/",
      icon: Youtube,
      activeColor: "bg-red-500/20 text-red-400 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]",
      hoverColor: "hover:text-red-400 hover:bg-red-500/10",
      active: pathname === "/",
    },
    {
      name: "Instagram",
      shortName: "Insta",
      mediumName: "Insta",
      href: "/instagram",
      icon: Instagram,
      activeColor: "bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 text-pink-300 border-pink-500/40 shadow-[0_0_12px_rgba(236,72,153,0.25)]",
      hoverColor: "hover:text-pink-400 hover:bg-pink-500/10",
      active: pathname === "/instagram",
    },
    {
      name: "Facebook",
      shortName: "FB",
      mediumName: "FB",
      href: "/facebook",
      icon: Facebook,
      activeColor: "bg-blue-600/25 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(37,99,235,0.25)]",
      hoverColor: "hover:text-blue-400 hover:bg-blue-500/10",
      active: pathname === "/facebook",
    },
  ];

  return (
    <header className="relative z-30 w-full max-w-full overflow-hidden border-b border-white/5 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-2.5 py-2 sm:px-6 sm:py-3 gap-1.5 sm:gap-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105 shrink-0">
            <Zap className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm sm:text-xl font-extrabold tracking-tight text-white flex items-center whitespace-nowrap">
            Snap<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Save</span>
            <span className="hidden md:inline-block ml-1 text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Pro
            </span>
          </span>
        </Link>

        {/* Central Platform Tabs Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl bg-black/50 border border-white/10 p-0.5 sm:p-1 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs md:text-sm font-bold rounded-lg sm:rounded-xl border transition-all whitespace-nowrap ${
                  item.active
                    ? item.activeColor
                    : `border-transparent text-slate-400 ${item.hoverColor}`
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                <span className="hidden md:inline">{item.name}</span>
                <span className="hidden xs:inline md:hidden">{item.mediumName}</span>
                <span className="xs:hidden">{item.shortName}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span>High-Speed Direct</span>
        </div>
      </div>
    </header>
  );
}
