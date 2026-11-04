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
} from "lucide-react";

interface SocialMediaResult {
  platform: string;
  title: string;
  thumbnail: string;
  uploader: string;
  duration: string;
  durationSeconds?: number;
  videoUrl: string;
  bestVideo: {
    url: string;
    qualityLabel: string;
    height: number;
    container: string;
    contentLength: string;
    requiresMerge?: boolean;
    audioStreamUrl?: string;
    isDirectCdn?: boolean;
  };
  bestAudio: {
    url: string;
    qualityLabel: string;
    container: string;
    contentLength: string;
  };
}

export default function FacebookPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SocialMediaResult | null>(null);
  const [turboMode, setTurboMode] = useState<boolean>(true);
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

  const handleStartVideoDownload = async () => {
    if (!result || startingJob) return;
    setStartingJob(true);

    try {
      const video = result.bestVideo;
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.videoUrl,
          videoStreamUrl: video.url,
          audioStreamUrl: video.audioStreamUrl,
          contentLength: video.contentLength,
          title: result.title,
          artist: result.uploader,
          format: "bestvideo+bestaudio/best",
          type: "merge",
          thumbnail: result.thumbnail,
          qualityLabel: video.qualityLabel,
          durationSeconds: result.durationSeconds,
          turbo: turboMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveJob({
          jobId: data.jobId,
          title: result.title,
          thumbnail: result.thumbnail,
          qualityLabel: video.qualityLabel,
          totalSizeText: video.contentLength ? `${(parseInt(video.contentLength) / (1024*1024)).toFixed(1)} MB` : undefined,
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

  const handleStartAudioDownload = async () => {
    if (!result || startingJob) return;
    setStartingJob(true);

    try {
      const audio = result.bestAudio;
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.videoUrl,
          audioStreamUrl: audio.url,
          contentLength: audio.contentLength,
          title: result.title,
          artist: result.uploader,
          type: "convert",
          bitrate: "320k",
          thumbnail: result.thumbnail,
          qualityLabel: "MP3 320 kbps Studio",
          durationSeconds: result.durationSeconds,
          turbo: turboMode,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveJob({
          jobId: data.jobId,
          title: result.title,
          thumbnail: result.thumbnail,
          qualityLabel: "MP3 Studio 320 kbps",
          totalSizeText: "Audio MP3",
        });
      } else {
        showToast(data.error || "Failed to start audio conversion job", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to start audio conversion job", "error");
    } finally {
      setStartingJob(false);
    }
  };

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative z-10 mx-auto max-w-4xl px-4 pt-12 pb-8 text-center sm:px-6">
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
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-400 mb-8">
            Paste any Facebook Watch, Reel, or public post link to download full HD MP4 video with crystal clear audio, or save the MP3 audio track directly.
          </p>

          {/* Input Box */}
          <form onSubmit={handleFetch} className="relative mx-auto max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-2.5 rounded-2xl bg-slate-900/90 border border-white/10 p-2 shadow-2xl backdrop-blur-xl">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste Facebook link here (e.g. https://www.facebook.com/watch/...)"
                className="flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
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

          {/* Engine Mode Toggle */}
          <div className="mt-6 inline-flex items-center gap-3 bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-xs">
            <span className="text-slate-400 font-medium">Download Engine:</span>
            <button
              type="button"
              onClick={() => setTurboMode(!turboMode)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all ${
                turboMode
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Zap className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{turboMode ? "⚡ Turbo Multi-Stream (16X)" : "Standard Mode"}</span>
            </button>
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
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <h2 className="text-lg font-bold text-white line-clamp-2">{result.title}</h2>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <User className="h-3.5 w-3.5 text-blue-400" />
                      {result.uploader}
                    </p>
                  </div>

                  {/* 2 Clear Options */}
                  <div className="mt-6 flex flex-col gap-3">
                    {/* Option 1: Highest Video MP4 */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={handleStartVideoDownload}
                        disabled={startingJob}
                        className="flex-1 flex items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 p-3.5 sm:p-4 font-bold text-white shadow-lg shadow-blue-500/25 hover:scale-[1.01] transition-all disabled:opacity-50 min-w-0"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white/20 shrink-0">
                            <Film className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <div className="text-xs sm:text-sm font-extrabold flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span>Highest Quality Video</span>
                              <span className="rounded bg-white/20 px-1.5 py-0.2 text-[9px] sm:text-[10px] uppercase">
                                {result.bestVideo.qualityLabel}
                              </span>
                            </div>
                            <span className="text-[11px] sm:text-xs text-blue-200 block truncate">
                              Lossless high-definition video & audio
                            </span>
                          </div>
                        </div>
                        <Download className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 ml-2" />
                      </button>

                      {result.bestVideo.isDirectCdn && (
                        <a
                          href={`/api/download?url=${encodeURIComponent(result.bestVideo.url)}&title=${encodeURIComponent(result.title)}`}
                          download
                          className="flex sm:flex-col items-center justify-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition-all font-bold text-xs shrink-0 text-center"
                          title="Instant 1-Click Direct Download"
                        >
                          <Zap className="h-4 w-4 text-emerald-400" />
                          <span>Fast 1-Click</span>
                        </a>
                      )}
                    </div>

                    {/* Option 2: Separate Audio MP3 */}
                    <button
                      onClick={handleStartAudioDownload}
                      disabled={startingJob}
                      className="flex items-center justify-between rounded-xl border border-purple-500/30 bg-purple-950/40 p-3.5 sm:p-4 font-bold text-white hover:bg-purple-900/50 transition-all disabled:opacity-50 min-w-0"
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 shrink-0">
                          <Music className="h-4 w-4 sm:h-5 sm:w-5" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-extrabold flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span>Audio Track Only</span>
                            <span className="rounded bg-purple-500/30 text-purple-300 px-1.5 py-0.2 text-[9px] sm:text-[10px] uppercase font-bold">
                              MP3 320 kbps
                            </span>
                          </div>
                          <span className="text-[11px] sm:text-xs text-slate-400 block truncate">
                            Studio sound with embedded ID3 metadata
                          </span>
                        </div>
                      </div>
                      <Download className="h-4 w-4 sm:h-5 sm:w-5 text-purple-400 shrink-0 ml-2" />
                    </button>
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
              <h3 className="font-bold text-white mb-2">FB Watch & Reels</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Save any Facebook Watch video, public Reel, or timeline clip in crystal clear 1080p Full HD.
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
              <h3 className="font-bold text-white mb-2">Safe & Instant</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Zero intrusive pop-ups or external bloat. Download directly with multi-stream speed acceleration.
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

