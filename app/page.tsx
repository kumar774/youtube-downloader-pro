"use client";

import React, { useState, useCallback } from "react";
import Header from "./components/Header";
import HeroInput from "./components/HeroInput";
import VideoCard, { VideoInfo } from "./components/VideoCard";
import FeaturesGrid from "./components/FeaturesGrid";
import { X, AlertTriangle } from "lucide-react";

export default function Home() {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  /* Show toast notification */
  const showToast = useCallback(
    (message: string, type: "error" | "success" = "error") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 5000);
    },
    []
  );

  /* Fetch video info from /api/info */
  const handleFetch = useCallback(
    async (url: string) => {
      setLoading(true);
      setVideoInfo(null);

      try {
        const res = await fetch("/api/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await res.json();

        if (!res.ok) {
          showToast(data.error || "Something went wrong.", "error");
          return;
        }

        if (!data.formats || data.formats.length === 0) {
          showToast(
            "No downloadable formats found for this video.",
            "error"
          );
          return;
        }

        setVideoInfo(data as VideoInfo);
      } catch (err) {
        console.error(err);
        showToast(
          "Network error — please check your connection and try again.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  return (
    <>
      <Header />

      <main className="flex-1">
        <HeroInput onFetch={handleFetch} loading={loading} />

        {videoInfo && <VideoCard info={videoInfo} />}

        <FeaturesGrid />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-600">
        <p>
          SnapSave — For personal &amp; educational use only. Not affiliated
          with YouTube.
        </p>
      </footer>

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast ${
            toast.type === "error" ? "toast-error" : "toast-success"
          } flex items-start gap-3`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
