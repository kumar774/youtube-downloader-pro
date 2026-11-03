"use client";

import React from "react";
import { Zap, Shield, Gauge, Globe } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "High-Speed Downloads",
    description:
      "Get your files converted and downloaded in seconds with our optimized processing engine.",
    color: "text-amber-400",
    glow: "shadow-amber-500/10",
    border: "border-amber-500/10",
  },
  {
    icon: Gauge,
    title: "No Speed Throttling",
    description:
      "Your downloads are processed at the highest possible speeds supported by your network connection.",
    color: "text-emerald-400",
    glow: "shadow-emerald-500/10",
    border: "border-emerald-500/10",
  },
  {
    icon: Shield,
    title: "Private & Secure",
    description:
      "No data stored, no tracking. Links are generated on-the-fly and never logged.",
    color: "text-indigo-400",
    glow: "shadow-indigo-500/10",
    border: "border-indigo-500/10",
  },
  {
    icon: Globe,
    title: "Any Format, Any Device",
    description:
      "MP4, WebM, M4A — choose the quality that works for you. Works on desktop, tablet, and mobile.",
    color: "text-purple-400",
    glow: "shadow-purple-500/10",
    border: "border-purple-500/10",
  },
];

export default function FeaturesGrid() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-indigo-400">
        Why SnapSave?
      </h2>
      <p className="mb-10 text-center text-2xl font-bold text-white sm:text-3xl">
        Engineered for Speed
      </p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`glass-card group flex flex-col items-start gap-4 p-6 animate-fade-in-up`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl border ${f.border} bg-white/5 shadow-lg ${f.glow} transition-transform group-hover:scale-110`}
            >
              <f.icon className={`h-5 w-5 ${f.color}`} />
            </div>
            <h3 className="text-base font-bold text-white">{f.title}</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              {f.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
