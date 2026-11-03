"use client";

import React from "react";
import { Zap } from "lucide-react";

export default function Header() {
  return (
    <header className="relative z-30 w-full border-b border-white/5">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        {/* Logo */}
        <a href="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
            <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Snap<span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Save</span>
          </span>
        </a>

        {/* Minimal nav */}
        <nav className="hidden items-center gap-6 sm:flex">
          <span className="flex items-center gap-1.5 text-sm text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            All systems online
          </span>
        </nav>
      </div>
    </header>
  );
}
