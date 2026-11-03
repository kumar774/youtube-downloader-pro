"use client";

import React, { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, X, Download, Sparkles, Zap, Film, Music, Check } from "lucide-react";

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
      await fetch(`/api/job/cancel?jobId=${jobId}`, { method: "POST" });
      setStatus("cancelled");
      onClose();
    } catch (err) {
      console.error("Failed to cancel job:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isMp3 = qualityLabel?.toLowerCase().includes("mp3");
  const numSegments = isTurbo ? 16 : 8;
  const activeSegmentIndex = Math.min(Math.floor((percent / 100) * numSegments), numSegments - 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Media Preview Header */}
        <div className="flex items-center gap-4 mb-5 pr-8">
          {thumbnail && (
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-800 border border-white/10">
              <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-white line-clamp-1">{title || "Downloading Media"}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {isTurbo ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
                  <Zap className="h-3 w-3 text-amber-400 fill-amber-400" />
                  ⚡ Turbo Multi-Stream (16X)
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
            </div>
          </div>
        </div>

        {/* 4-Step Flow Indicator */}
        <div className="mb-5 grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
          <div
            className={`py-1.5 rounded-xl border transition-all ${
              percent >= 5
                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            1. Connect
          </div>
          <div
            className={`py-1.5 rounded-xl border transition-all ${
              status === "downloading" || (percent >= 15 && percent < 85)
                ? "border-amber-500/60 bg-amber-500/25 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] animate-pulse"
                : percent >= 85
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            2. Stream Buffer
          </div>
          <div
            className={`py-1.5 rounded-xl border transition-all ${
              status === "merging" || (percent >= 85 && percent < 100)
                ? "border-purple-500/60 bg-purple-500/25 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.25)] animate-pulse"
                : percent >= 100
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            3. {isMp3 ? "Studio Encode" : "Audio-Video Sync"}
          </div>
          <div
            className={`py-1.5 rounded-xl border transition-all ${
              status === "completed" || percent >= 100
                ? "border-emerald-500/60 bg-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)] font-black"
                : "border-white/5 bg-white/[0.02] text-slate-500"
            }`}
          >
            4. Ready
          </div>
        </div>

        {/* Dynamic Display: Phase 1 (Downloading) vs Phase 2 (Merging) */}
        {status === "merging" ? (
          /* ── Track Synchronization Phase (Clear separation from download) ── */
          <div className="mb-5 rounded-2xl border border-purple-500/30 bg-purple-950/30 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-purple-300 mb-3">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-400" />
                {isMp3 ? "Studio Audio Conversion in Progress" : "Track Synchronization in Progress"}
              </span>
              <span className="text-white font-mono">{Math.round(percent)}%</span>
            </div>

            {/* Sync Track Matrix */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-semibold mb-1">
                  <Check className="h-3.5 w-3.5" />
                  <span>{isMp3 ? "Audio Stream" : "Video Stream"}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">100% Downloaded</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2.5">
                <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-semibold mb-1">
                  <Check className="h-3.5 w-3.5" />
                  <span>{isMp3 ? "ID3 Metadata" : "Audio Track"}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">100% Ready</span>
              </div>
            </div>

            <p className="text-center text-xs text-purple-200/80">
              {isMp3
                ? "Encoding audio track into crystal-clear 320 kbps MP3 with embedded tags..."
                : "Synchronizing lossless video and crystal-clear audio tracks without quality loss..."}
            </p>
          </div>
        ) : (
          /* ── Authentic VidMate / IDM Segmented Stream Buffer ── */
          <div className="mb-5 rounded-2xl border border-white/10 bg-black/50 p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                {isTurbo ? "Turbo 16-Connection Stream Accelerator" : "Standard Single Stream Buffer"}
              </span>
              <span className="text-white font-mono font-bold text-xs">
                {downloadedBytes > 0 && totalBytes > 0
                  ? `${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`
                  : totalSizeText
                  ? `${Math.round(percent)}% of ${totalSizeText}`
                  : `${Math.round(percent)}%`}
              </span>
            </div>

            {/* Segmented multi-connection buffer strip */}
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-1 mb-2">
              {Array.from({ length: numSegments }).map((_, idx) => {
                const isFilled = idx < activeSegmentIndex;
                const isActive = idx === activeSegmentIndex && percent < 100;

                return (
                  <div
                    key={idx}
                    className={`h-4 rounded-md transition-all duration-300 border ${
                      isFilled
                        ? "bg-gradient-to-t from-emerald-500 to-teal-400 border-emerald-400/50 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : isActive
                        ? "bg-gradient-to-t from-amber-500 to-yellow-300 border-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                        : "bg-slate-800/80 border-white/5"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-mono">
                {percent >= 100
                  ? "All stream buffers completed"
                  : isTurbo
                  ? `Active buffer segments: ${Math.min(activeSegmentIndex + 1, numSegments)} / ${numSegments}`
                  : "Single thread buffer receiving"}
              </span>
              <span className="font-mono font-bold text-slate-200">{Math.round(percent)}%</span>
            </div>
          </div>
        )}

        {/* Overall Status Stage Text */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 font-medium text-slate-200">
            {status === "completed" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : status === "failed" ? (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
            )}
            <span className="line-clamp-1 font-semibold">{stage}</span>
          </div>
          <span className="font-extrabold text-white ml-2 text-base">{Math.round(percent)}%</span>
        </div>

        {/* Master Progress Bar */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800 border border-white/10 mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              status === "completed"
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
                : status === "merging"
                ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-emerald-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                : "bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>

        {/* Live Metrics Row */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-6 font-mono">
          <span className="flex items-center gap-1 font-semibold text-slate-300">
            <Zap className="h-3 w-3 text-amber-400" />
            {speed ? `Speed: ${speed}` : isTurbo ? "Speed: 14.8 MB/s (Turbo)" : "Speed: 3.8 MB/s"}
          </span>
          <span className="text-slate-300">
            {status === "completed" ? "Status: Ready" : eta ? `ETA: ${eta}` : "Calculating remaining time..."}
          </span>
        </div>

        {/* Error Display */}
        {status === "failed" && (
          <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error || "An error occurred while preparing download. Please try another quality."}
          </div>
        )}

        {/* Action Button Row */}
        <div className="pt-2">
          {status === "completed" ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <a
                href={`/api/job/download?jobId=${jobId}`}
                download
                className="w-full flex-1 flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Save File to Disk {totalSizeText ? `(${totalSizeText})` : ""}</span>
              </a>
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-bold rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : status === "failed" ? (
            <div className="flex w-full justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-sm font-bold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {status === "merging" ? "Synchronizing lossless tracks..." : isTurbo ? "Turbo 16-channel streaming..." : "Standard streaming..."}
              </span>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 text-xs font-bold rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
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
