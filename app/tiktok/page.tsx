"use client";

import React, { useState, useCallback } from "react";
import Header from "../components/Header";
import {
  Download,
  Music,
  Film,
  Zap,
  ArrowRight,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface SocialVideoFormat {
  itag: string;
  qualityLabel: string;
  height: number;
  width?: number;
  container: string;
  url: string;
  contentLength: string;
  requiresMerge: boolean;
  audioStreamUrl?: string;
  isDirectCdn: boolean;
  badge?: string;
}

interface TikTokResult {
  platform: string;
  title: string;
  thumbnail: string;
  uploader: string;
  duration: string;
  durationSeconds?: number;
  videoUrl: string;
  videoFormats?: SocialVideoFormat[];
  bestVideo: SocialVideoFormat;
  bestAudio: {
    url: string;
    qualityLabel: string;
    container: string;
    contentLength: string;
  };
}

function formatSize(bytesStr?: string) {
  if (!bytesStr) return "";
  const b = parseInt(bytesStr, 10);
  if (isNaN(b) || b <= 0) return "";
  const mb = b / (1024 * 1024);
  if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export default function TikTokPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TikTokResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const showToast = useCallback((message: string, type: "error" | "success" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleFetch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      showToast("Please paste a TikTok video link.", "error");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl, platform: "tiktok" }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to fetch TikTok video.", "error");
        return;
      }

      setResult(data as TikTokResult);
    } catch (err) {
      console.error(err);
      showToast("Network error. Please check your connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  const displayFormats: SocialVideoFormat[] =
    result?.videoFormats && result.videoFormats.length > 0
      ? result.videoFormats
      : result
      ? [result.bestVideo]
      : [];

  return (
    <>
      <Header />

      <main className="flex-1 w-full max-w-full overflow-hidden">
        {/* Hero Section */}
        <section className="relative z-10 mx-auto max-w-4xl px-4 pt-10 pb-6 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-bold text-cyan-300 shadow-lg mb-6">
            <Music className="h-4 w-4 text-cyan-400" />
            <span>TikTok Video & MP3 Downloader</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-3 break-words">
            Download{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-500 bg-clip-text text-transparent">
              TikTok Videos Without Watermark
            </span>{" "}
            in HD
          </h1>
          <p className="mx-auto max-w-2xl text-xs sm:text-base text-slate-400 mb-8">
            Paste any TikTok link to download clean, watermark-free videos in crisp 1080p Full HD MP4 or extract the background audio track as an MP3.
          </p>

          {/* Input Box */}
          <form onSubmit={handleFetch} className="relative mx-auto max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-2.5 rounded-2xl bg-slate-900/90 border border-white/10 p-2 shadow-2xl backdrop-blur-xl">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste TikTok link here (e.g. https://www.tiktok.com/@.../video/... or vm.tiktok.com/...)"
                className="flex-1 bg-transparent px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <span>Fetching TikTok...</span>
                ) : (
                  <>
                    <span>Download</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Speed & Feature Badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-semibold text-cyan-300">
            <Zap className="h-3 w-3 text-cyan-400 fill-cyan-400" />
            <span>100% Clean No Watermark · Full HD 1080p · Instant 1-Click Browser Save</span>
          </div>
        </section>

        {/* Result Card */}
        {result && (
          <section className="relative z-10 mx-auto max-w-3xl px-4 pb-16 sm:px-6 animate-fade-in-up">
            <div className="rounded-2xl border border-white/10 bg-slate-900/90 overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="relative w-full sm:w-64 shrink-0 bg-black/60">
                  <img
                    src={result.thumbnail}
                    alt={result.title}
                    className="h-56 sm:h-full w-full object-cover"
                  />
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
                    <Clock className="h-3 w-3" />
                    {result.duration}
                  </span>
                </div>

                {/* Details & Actions */}
                <div className="flex flex-1 flex-col justify-between p-4 sm:p-6 min-w-0">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white line-clamp-2 break-words">{result.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <User className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <span className="truncate">@{result.uploader}</span>
                    </p>
                  </div>

                  {/* Section 1: Video Formats by Quality */}
                  <div className="mt-6 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1 border-b border-white/5">
                      <span className="flex items-center gap-1.5 text-cyan-400 uppercase tracking-wider text-[11px] font-bold">
                        <Film className="h-3.5 w-3.5" />
                        Available Video Qualities (MP4)
                      </span>
                      <span className="text-[10px] text-slate-400">Direct Save</span>
                    </div>

                    {displayFormats.map((f, idx) => {
                      const isNoWatermark = f.qualityLabel.toLowerCase().includes("no watermark");
                      const isHighTier = f.height >= 1080;
                      return (
                        <div
                          key={`tt-fmt-${idx}`}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 sm:p-3 hover:border-white/15 hover:bg-white/[0.04] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg font-bold text-xs shrink-0 ${
                                isHighTier
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              <Film className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-bold text-white">
                                  {f.qualityLabel}
                                </span>
                                {isNoWatermark && (
                                  <span className="rounded bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 text-[9px] uppercase font-bold border border-cyan-500/30">
                                    No Watermark
                                  </span>
                                )}
                                {f.contentLength && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {formatSize(f.contentLength)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
                                {isNoWatermark
                                  ? "✨ Clean crystal-clear original video without logo"
                                  : "Original stream with creator watermark"}
                              </span>
                            </div>
                          </div>

                          <a
                            href={`/api/download?url=${encodeURIComponent(f.url)}&title=${encodeURIComponent(result.title)}&ext=mp4`}
                            download
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all shrink-0 ${
                              isHighTier
                                ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/20 hover:scale-[1.02]"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                            }`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Fast 1-Click</span>
                            <span className="sm:hidden">Fast</span>
                          </a>
                        </div>
                      );
                    })}

                    {/* Section 2: Separate Audio Section */}
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1.5">
                        <span className="flex items-center gap-1.5 text-purple-400 uppercase tracking-wider text-[11px] font-bold">
                          <Music className="h-3.5 w-3.5" />
                          Audio Track (Sound Only)
                        </span>
                        <span className="text-[10px] text-purple-300 font-mono">MP3 Audio</span>
                      </div>

                      <a
                        href={`/api/download?url=${encodeURIComponent(result.bestAudio.url)}&title=${encodeURIComponent(result.title)}&ext=mp3`}
                        download
                        className="flex items-center justify-between gap-2.5 rounded-xl border border-purple-500/30 bg-purple-950/30 p-2.5 sm:p-3 hover:bg-purple-900/40 hover:border-purple-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300 shrink-0">
                            <Music className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-white">
                                {result.bestAudio.qualityLabel}
                              </span>
                              <span className="rounded bg-purple-500/30 text-purple-200 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Audio MP3
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-purple-300/70 block truncate">
                              🎵 Background music & sound · 1-Click Direct Download
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 rounded-lg bg-purple-500/20 text-purple-200 px-3 py-1.5 text-xs font-bold shrink-0 group-hover:bg-purple-500/30 transition-colors">
                          <Download className="h-3.5 w-3.5" />
                          <span>Save MP3</span>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Feature Highlights */}
        <section className="relative z-10 mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-4">
                <Film className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">Zero Watermark</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Download the master unwatermarked video file without any distracting bouncing TikTok logos.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-4">
                <Music className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">MP3 Sound Ripper</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extract trending songs, audio tracks, and viral dialogues directly into high-fidelity MP3 files.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">Fast 1-Click Save</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct browser download straight from CDN at 20-50 MB/s speed with zero server queuing.
              </p>
            </div>
          </div>
        </section>
      </main>

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
            ✕
          </button>
        </div>
      )}
    </>
  );
}
