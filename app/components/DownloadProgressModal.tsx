"use client";

import React, { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, X, Download, Sparkles, Zap } from "lucide-react";

interface DownloadProgressModalProps {
  jobId: string;
  title: string;
  thumbnail?: string;
  qualityLabel?: string;
  totalSizeText?: string;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function getChannelProgress(basePct: number, channelIndex: number, totalChannels: number = 16): number {
  if (basePct >= 100) return 100;
  if (basePct <= 0) return 0;
  const offset = ((channelIndex * 7) % 11) - 5;
  const target = basePct + offset * (1 - basePct / 100);
  return Math.min(Math.max(Math.round(target), 2), 100);
}

export default function DownloadProgressModal({
  jobId,
  title,
  thumbnail,
  qualityLabel,
  totalSizeText,
  onClose,
}: DownloadProgressModalProps) {
  const [percent, setPercent] = useState<number>(0);
  const [stage, setStage] = useState<string>("Connecting to high-speed stream...");
  const [speed, setSpeed] = useState<string>("");
  const [eta, setEta] = useState<string>("");
  const [status, setStatus] = useState<"starting" | "downloading" | "merging" | "completed" | "failed" | "cancelled">("starting");
  const [error, setError] = useState<string>("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [isTurbo, setIsTurbo] = useState<boolean>(true);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [activeChunks, setActiveChunks] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(16);
  const hasTriggeredDownload = useRef(false);

  useEffect(() => {
    const eventSource = new EventSource(`/api/job/progress?jobId=${jobId}`);

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status) setStatus(data.status);
        if (typeof data.percent === "number") setPercent(data.percent);
        if (data.stage) setStage(data.stage);
        if (data.speed) setSpeed(data.speed);
        if (data.eta) setEta(data.eta);
        if (data.error) setError(data.error);
        if (typeof data.turbo === "boolean") setIsTurbo(data.turbo);
        if (typeof data.downloadedBytes === "number") setDownloadedBytes(data.downloadedBytes);
        if (typeof data.totalBytes === "number") setTotalBytes(data.totalBytes);
        if (typeof data.activeChunks === "number") setActiveChunks(data.activeChunks);
        if (typeof data.totalChunks === "number") setTotalChunks(data.totalChunks);

        if (data.status === "completed" && !hasTriggeredDownload.current) {
          hasTriggeredDownload.current = true;
          setPercent(100);
          setStage("Download complete! File saved.");

          // Direct browser download trigger via native anchor
          const downloadUrl = `/api/job/download?jobId=${jobId}`;
          const link = document.createElement("a");
          link.href = downloadUrl;
          const safeName = (title || "video").replace(/[^\w\s\-().]/g, "").replace(/\s+/g, "_");
          const ext = qualityLabel?.toLowerCase().includes("mp3") ? "mp3" : "mp4";
          link.download = `${safeName}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        console.error("Failed to parse progress event:", err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [jobId, title, qualityLabel]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await fetch("/api/job/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
    } catch (e) {
      console.error("Cancel failed:", e);
    } finally {
      setIsCancelling(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl animate-fade-in-up">
        {/* Close Button at Top Right */}
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          title="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Video Info Header */}
        <div className="flex gap-4 items-center mb-5 pr-8">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="h-16 w-24 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="h-16 w-24 rounded-lg bg-slate-800 flex items-center justify-center border border-white/10 shrink-0">
              <Download className="h-6 w-6 text-indigo-400" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">{title}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {isTurbo ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <Zap className="h-3 w-3 text-amber-400 fill-amber-400" />
                  ⚡ Turbo 16X Multi-Stream
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300 border border-slate-700">
                  Standard Stream
                </span>
              )}
              {qualityLabel && (
                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="h-3 w-3" />
                  {qualityLabel}
                </span>
              )}
              {status === "merging" && (
                <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300 border border-purple-500/30">
                  High-Speed Stream Sync
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4-Step Progress Flow Indicator */}
        <div className="mb-4 grid grid-cols-4 gap-1.5 text-center text-[10px] font-semibold">
          <div
            className={`py-1 rounded-lg border transition-all ${
              percent >= 10
                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            1. Connect
          </div>
          <div
            className={`py-1 rounded-lg border transition-all ${
              percent >= 25
                ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            2. Multi-Stream
          </div>
          <div
            className={`py-1 rounded-lg border transition-all ${
              percent >= 70
                ? "border-purple-500/50 bg-purple-500/20 text-purple-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            3. Audio Sync
          </div>
          <div
            className={`py-1 rounded-lg border transition-all ${
              percent >= 100
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            4. Ready
          </div>
        </div>

        {/* VidMate 16-Channel Multi-Stream Visualizer (Turbo Mode) */}
        {isTurbo ? (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-3.5">
            <div className="flex items-center justify-between text-xs mb-2.5">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                Turbo 16-Channel Stream Accelerator
              </span>
              <span className="text-slate-300 font-mono font-bold text-[11px]">
                {downloadedBytes > 0
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : totalSizeText
                  ? `${Math.round(percent)}% of ${totalSizeText}`
                  : `${Math.round(percent)}%`}
              </span>
            </div>

            {/* 16 Channels Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Array.from({ length: 16 }).map((_, idx) => {
                const chPct = getChannelProgress(percent, idx, 16);
                return (
                  <div key={idx} className="rounded-lg bg-slate-900/80 border border-white/5 p-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span className="font-mono">CH {String(idx + 1).padStart(2, "0")}</span>
                      <span className="font-bold text-slate-200">{chPct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${chPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-white/10 bg-black/40 p-3.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">Standard Single Stream</span>
              <span className="text-slate-300 font-mono font-bold text-[11px]">
                {downloadedBytes > 0
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : `${Math.round(percent)}%`}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Stage Text */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium text-slate-200">
            {status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : status === "failed" ? (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
            )}
            <span className="line-clamp-1">{stage}</span>
          </div>
          <span className="font-bold text-white ml-2">{Math.round(percent)}%</span>
        </div>

        {/* Animated Progress Bar */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-white/5 mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-5">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-amber-400" />
            {speed ? `Speed: ${speed}` : isTurbo ? "Speed: 14.5 MB/s (Turbo)" : "Speed: 3.8 MB/s"}
          </span>
          <span>{eta ? `ETA: ${eta}` : percent >= 100 ? "Ready" : "Calculating..."}</span>
        </div>

        {/* Error Display */}
        {status === "failed" && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error || "An error occurred while preparing download. Please try another quality."}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {status === "completed" ? (
            <>
              <a
                href={`/api/job/download?jobId=${jobId}`}
                download
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:scale-[1.02] transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Save File to Disk {totalSizeText ? `(${totalSizeText})` : ""}</span>
              </a>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-3 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </>
          ) : status === "failed" ? (
            <div className="flex w-full justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-slate-400">
                {isTurbo ? "⚡ 16 channels streaming..." : "Standard single-stream buffering..."}
              </span>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
