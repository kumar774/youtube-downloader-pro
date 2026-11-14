"use client";

import React, { useState, useCallback } from "react";
import Header from "../components/Header";
import DownloadProgressModal from "../components/DownloadProgressModal";
import {
  Facebook,
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
}

interface SocialMediaResult {
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

export default function FacebookPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialMediaResult | null>(null);
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    title: string;
    thumbnail?: string;
    qualityLabel?: string;
    totalSizeText?: string;
  } | null>(null);
  const [startingJob, setStartingJob] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);

  const showToast = useCallback((message: string, type: "error" | "success" = "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleFetch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      showToast("Please paste a Facebook Video or Reel URL.", "error");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl, platform: "facebook" }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to fetch Facebook video.", "error");
        return;
      }

      setResult(data as SocialMediaResult);
    } catch (err) {
      console.error(err);
      showToast("Network error. Please check your connection.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStartMerge = async (format: SocialVideoFormat) => {
    if (!result || startingJob) return;
    setStartingJob(true);

    try {
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.videoUrl,
          videoStreamUrl: format.url,
          audioStreamUrl: format.audioStreamUrl,
          contentLength: format.contentLength,
          title: result.title,
          artist: result.uploader,
          format: "bestvideo+bestaudio/best",
          type: "merge",
          thumbnail: result.thumbnail,
          qualityLabel: format.qualityLabel,
          durationSeconds: result.durationSeconds,
          turbo: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveJob({
          jobId: data.jobId,
          title: result.title,
          thumbnail: result.thumbnail,
          qualityLabel: format.qualityLabel,
          totalSizeText: formatSize(format.contentLength),
        });
      } else {
        showToast(data.error || "Failed to start download job", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to start download job", "error");
    } finally {
      setStartingJob(false);
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
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-bold text-blue-300 shadow-lg mb-6">
            <Facebook className="h-4 w-4 text-blue-400" />
            <span>Facebook Watch & Reels Downloader</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mb-3 break-words">
            Download{" "}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Facebook Videos & Audio
            </span>{" "}
            in High Quality
          </h1>
          <p className="mx-auto max-w-2xl text-xs sm:text-base text-slate-400 mb-8">
            Paste any Facebook Watch or Reel link to download in original 1080p Full HD with sound, or extract the MP3 audio track directly.
          </p>

          {/* Input Box */}
          <form onSubmit={handleFetch} className="relative mx-auto max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-2.5 rounded-2xl bg-slate-900/90 border border-white/10 p-2 shadow-2xl backdrop-blur-xl">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Facebook link here (e.g. https://www.facebook.com/watch/...)"
                className="flex-1 bg-transparent px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shrink-0"
              >
                {loading ? (
                  <span>Fetching Video...</span>
                ) : (
                  <>
                    <span>Download</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Speed Badge */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-300">
            <Zap className="h-3 w-3 text-emerald-400 fill-emerald-400" />
            <span>Highest Quality 1080p Support · Lossless Audio Sync · Fast Browser Save</span>
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
                      <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      <span className="truncate">{result.uploader}</span>
                    </p>
                  </div>

                  {/* Section 1: Video Formats by Quality */}
                  <div className="mt-6 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-1 border-b border-white/5">
                      <span className="flex items-center gap-1.5 text-blue-400 uppercase tracking-wider text-[11px] font-bold">
                        <Film className="h-3.5 w-3.5" />
                        Available Video Qualities
                      </span>
                      <span className="text-[10px] text-slate-400">MP4 Format</span>
                    </div>

                    {displayFormats.map((f, idx) => {
                      const isHighTier = f.height >= 1080;
                      return (
                        <div
                          key={`fb-fmt-${idx}`}
                          className="flex items-center justify-between gap-2.5 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 sm:p-3 hover:border-white/15 hover:bg-white/[0.04] transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg font-bold text-xs shrink-0 ${
                                isHighTier
                                  ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
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
                                {isHighTier && (
                                  <span className="rounded bg-blue-500/20 text-blue-300 px-1.5 py-0.2 text-[9px] uppercase font-bold border border-blue-500/30">
                                    Full HD
                                  </span>
                                )}
                                {f.contentLength && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {formatSize(f.contentLength)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
                                {f.requiresMerge
                                  ? "🎬 Auto-merged with crystal-clear audio"
                                  : "⚡ Instant 1-Click Fast Save"}
                              </span>
                            </div>
                          </div>

                          {f.requiresMerge ? (
                            <button
                              onClick={() => handleStartMerge(f)}
                              disabled={startingJob}
                              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all shrink-0 disabled:opacity-50"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Merge & Download</span>
                              <span className="sm:hidden">Download</span>
                            </button>
                          ) : (
                            <a
                              href={`/api/download?url=${encodeURIComponent(f.url)}&title=${encodeURIComponent(result.title)}&ext=mp4`}
                              download
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-2 text-xs font-bold hover:bg-emerald-500/30 transition-all shrink-0"
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-400" />
                              <span className="hidden sm:inline">Fast 1-Click</span>
                              <span className="sm:hidden">Fast</span>
                            </a>
                          )}
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
                        <span className="text-[10px] text-purple-300 font-mono">MP3 320 kbps</span>
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
                                Audio Track (MP3)
                              </span>
                              <span className="rounded bg-purple-500/30 text-purple-200 px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                Studio HD
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-purple-300/70 block truncate">
                              🎵 High-bitrate audio track · Fast 1-Click Download
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
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 mb-4">
                <Film className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">Original Full HD 1080p</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Lossless audio-video synchronization guarantees original 1080p clarity with crystal-clear sound.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 mb-4">
                <Music className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">MP3 Sound Extractor</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Extract audio tracks, podcast clips, or song segments into high-fidelity 320 kbps MP3 files.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white mb-2">All Quality Tiers</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select any resolution from Full HD down to standard mobile formats with instant 1-click downloads.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Progress Modal */}
      {activeJob && (
        <DownloadProgressModal
          jobId={activeJob.jobId}
          title={activeJob.title}
          thumbnail={activeJob.thumbnail}
          qualityLabel={activeJob.qualityLabel}
          totalSizeText={activeJob.totalSizeText}
          onClose={() => setActiveJob(null)}
        />
      )}

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
