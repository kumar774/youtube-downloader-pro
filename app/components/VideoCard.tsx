"use client";

import React, { useState } from "react";
import {
  Download,
  Film,
  Music,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  VolumeX,
  Sparkles,
  Zap,
  Scissors,
  FileText,
} from "lucide-react";
import DownloadProgressModal from "./DownloadProgressModal";

/* ── Types ──────────────────────────────────── */
export interface FormatInfo {
  itag: string | number;
  quality: string;
  qualityLabel: string;
  container: string;
  url: string;
  hasAudio: boolean;
  hasVideo: boolean;
  contentLength?: string;
  mimeType?: string;
  requiresMerge?: boolean;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  author: string;
  videoUrl: string;
  formats: {
    withAudio: FormatInfo[];
    withoutAudio: FormatInfo[];
    audioOnly: FormatInfo[];
  };
}

/* ── Helpers ────────────────────────────────── */
function fileSize(bytes?: string) {
  if (!bytes) return "";
  const mb = parseInt(bytes, 10) / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(mb * 1024).toFixed(0)} KB`;
}

function sanitizeFilename(title: string) {
  return title.replace(/[<>:"/\\|?*]+/g, "").trim();
}

function buildProxyUrl(cdnUrl: string, title: string, container: string) {
  const params = new URLSearchParams({
    url: cdnUrl,
    title: sanitizeFilename(title),
    ext: container,
  });
  return `/api/download?${params.toString()}`;
}

/* ── Component ──────────────────────────────── */
export default function VideoCard({ info }: { info: VideoInfo }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState<"320k" | "192k" | "128k">("320k");
  const [turboMode, setTurboMode] = useState<boolean>(true);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    title: string;
    thumbnail?: string;
    qualityLabel?: string;
  } | null>(null);
  const [startingJob, setStartingJob] = useState(false);

  const { withAudio, withoutAudio, audioOnly } = info.formats || {
    withAudio: [],
    withoutAudio: [],
    audioOnly: [],
  };

  const visibleVideoWithAudio =
    showAll || withAudio.length <= 6 ? withAudio : withAudio.slice(0, 6);
  const visibleVideoMuted = showAll ? withoutAudio : withoutAudio.slice(0, 3);
  const visibleAudio = showAll ? audioOnly : audioOnly.slice(0, 3);

  const totalFormats = withAudio.length + withoutAudio.length + audioOnly.length;
  const hasHidden =
    totalFormats >
    visibleVideoWithAudio.length + visibleVideoMuted.length + visibleAudio.length;

  const handleStartMerge = async (formatId: string, qualityLabel: string) => {
    if (startingJob) return;
    setStartingJob(true);

    try {
      const formatSelector = formatId.includes("+") ? formatId : `${formatId}+bestaudio`;
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.videoUrl,
          title: info.title,
          artist: info.author,
          format: formatSelector,
          type: "merge",
          thumbnail: info.thumbnail,
          qualityLabel: qualityLabel,
          turbo: turboMode,
          clipStart: clipEnabled && clipStart.trim() ? clipStart.trim() : undefined,
          clipEnd: clipEnabled && clipEnd.trim() ? clipEnd.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveJob({
          jobId: data.jobId,
          title: info.title,
          thumbnail: info.thumbnail,
          qualityLabel: qualityLabel,
        });
      } else {
        alert(data.error || "Failed to start download job");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to start download job. Please check network connection.");
    } finally {
      setStartingJob(false);
    }
  };

  const handleStartConvert = async (bitrate: "320k" | "192k" | "128k" = selectedBitrate) => {
    if (startingJob) return;
    setStartingJob(true);

    try {
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.videoUrl,
          title: info.title,
          artist: info.author,
          type: "convert",
          bitrate,
          thumbnail: info.thumbnail,
          qualityLabel: `MP3 ${bitrate.replace("k", " kbps")} Studio`,
          turbo: turboMode,
          clipStart: clipEnabled && clipStart.trim() ? clipStart.trim() : undefined,
          clipEnd: clipEnabled && clipEnd.trim() ? clipEnd.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.jobId) {
        setActiveJob({
          jobId: data.jobId,
          title: info.title,
          thumbnail: info.thumbnail,
          qualityLabel: `MP3 ${bitrate.replace("k", " kbps")}`,
        });
      } else {
        alert(data.error || "Failed to start audio conversion job");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to start audio conversion job");
    } finally {
      setStartingJob(false);
    }
  };

  return (
    <section className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-16 sm:px-6 animate-fade-in-up">
      <div className="glass-card overflow-hidden">
        {/* ── Top: Thumbnail + Meta ──────────────── */}
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative w-full sm:w-72 md:w-80 shrink-0">
            <img
              src={info.thumbnail}
              alt={info.title}
              className="h-44 w-full object-cover sm:h-full"
            />
            {/* Duration badge */}
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
              <Clock className="h-3 w-3" />
              {info.duration}
            </span>
          </div>

          {/* Meta */}
          <div className="flex flex-1 flex-col justify-center gap-4 p-5 sm:p-6">
            <div>
              <h2 className="text-lg font-bold leading-snug text-white line-clamp-2 sm:text-xl">
                {info.title}
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-400">
                <User className="h-3.5 w-3.5" />
                {info.author}
              </p>
            </div>
          </div>
        </div>

        {/* ── Download Section ───────────────────── */}
        <div className="border-t border-white/5 px-5 py-5 sm:px-6">
          {/* Download Speed Mode Toggle Switch */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-800/60 to-slate-900/90 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                  turboMode
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                    : "border-slate-700 bg-slate-800/80 text-slate-400"
                }`}
              >
                <Zap className={`h-6 w-6 transition-all ${turboMode ? "animate-pulse fill-amber-400" : ""}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Download Engine Mode</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                      turboMode
                        ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-500/40 shadow-sm"
                        : "bg-slate-700/60 text-slate-400 border border-slate-600/30"
                    }`}
                  >
                    {turboMode ? "⚡ Turbo Multi-Stream" : "Standard Mode"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {turboMode
                    ? "High-speed multi-threaded download buffer enabled"
                    : "Standard single-stream download"}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 self-end sm:self-center bg-black/30 px-3.5 py-2 rounded-xl border border-white/5">
              <span
                onClick={() => setTurboMode(false)}
                className={`text-xs cursor-pointer select-none transition-colors ${
                  !turboMode ? "text-white font-bold" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Normal
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={turboMode}
                onClick={() => setTurboMode(!turboMode)}
                className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  turboMode ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]" : "bg-slate-700"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                    turboMode ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                onClick={() => setTurboMode(true)}
                className={`text-xs cursor-pointer select-none transition-colors ${
                  turboMode ? "text-amber-400 font-extrabold flex items-center gap-1" : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Turbo ⚡
              </span>
            </div>
          </div>

          {/* Clip / Segment Cutter (Optional Feature) */}
          <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Scissors className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Smart Clip Cutter</span>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.2 text-[10px] font-black text-amber-300 uppercase">
                      New
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Download only your favorite part (e.g. 00:00:30 to 00:01:45)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setClipEnabled(!clipEnabled)}
                className={`self-start sm:self-center px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  clipEnabled
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                }`}
              >
                {clipEnabled ? "Trim Active ✓" : "+ Enable Cutter"}
              </button>
            </div>

            {clipEnabled && (
              <div className="mt-3.5 pt-3.5 border-t border-white/5 flex flex-wrap items-center gap-4 animate-fade-in">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-400">Start Time:</label>
                  <input
                    type="text"
                    placeholder="00:00:15"
                    value={clipStart}
                    onChange={(e) => setClipStart(e.target.value)}
                    className="w-24 rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-slate-400">End Time:</label>
                  <input
                    type="text"
                    placeholder="00:01:30"
                    value={clipEnd}
                    onChange={(e) => setClipEnd(e.target.value)}
                    className="w-24 rounded-lg bg-black/50 border border-white/10 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <span className="text-[11px] text-amber-400/90 italic">
                  *All downloads below will extract only this trimmed section.
                </span>
              </div>
            )}
          </div>

          {/* Primary Section: Video + Audio */}
          {withAudio.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Film className="h-4 w-4 text-emerald-400" />
                Ready to Watch / With Audio
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleVideoWithAudio.map((f, i) => (
                  <FormatRow
                    key={`vwa-${i}`}
                    f={f}
                    title={info.title}
                    variant="green"
                    onStartMerge={handleStartMerge}
                    disabled={startingJob}
                    turboMode={turboMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Secondary Section: Audio Only */}
          {audioOnly.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <Music className="h-4 w-4 text-purple-400" />
                Audio Only / MP3
              </h3>

              {/* Auto MP3 Convert Banner with Bitrate Studio */}
              {info.videoUrl && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      MP3 Studio Suite{" "}
                      <span className="bg-purple-500/20 text-purple-300 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold">
                        ⚡ Turbo 8X
                      </span>
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      Extracts crystal clear audio with high-speed parallel download
                    </span>
                    {/* Bitrate Selector Pills */}
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <span className="text-xs text-slate-400 font-medium mr-1">Bitrate:</span>
                      {(["320k", "192k", "128k"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setSelectedBitrate(b)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                            selectedBitrate === b
                              ? "bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                              : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {b === "320k" ? "320 kbps (HD)" : b === "192k" ? "192 kbps" : "128 kbps"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartConvert(selectedBitrate)}
                    disabled={startingJob}
                    className={`flex shrink-0 items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50 ${
                      turboMode
                        ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-500 text-white shadow-purple-500/30"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-200"
                    }`}
                  >
                    {turboMode ? (
                      <>
                        <Zap className="h-4 w-4 text-amber-300 fill-amber-300" />
                        <span>Convert to MP3 (Turbo ⚡)</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        <span>Convert to MP3 (Normal)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleAudio.map((f, i) => (
                  <FormatRow
                    key={`a-${i}`}
                    f={f}
                    title={info.title}
                    variant="purple"
                    onStartMerge={handleStartMerge}
                    disabled={startingJob}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Subtitles & Lyrics Extractor */}
          <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <FileText className="h-4 w-4 text-cyan-400" />
                Subtitles & Lyrics Extractor
              </h3>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-cyan-500/30">
                1-Click Download
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href={`/api/subtitles?url=${encodeURIComponent(info.videoUrl)}&title=${encodeURIComponent(info.title)}&format=txt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Clean Lyrics
                  </span>
                  <span className="text-xs text-slate-400">Plain Text (.TXT)</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0" />
              </a>

              <a
                href={`/api/subtitles?url=${encodeURIComponent(info.videoUrl)}&title=${encodeURIComponent(info.title)}&format=srt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Subtitles (SRT)
                  </span>
                  <span className="text-xs text-slate-400">Time-synced (.SRT)</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0" />
              </a>

              <a
                href={`/api/subtitles?url=${encodeURIComponent(info.videoUrl)}&title=${encodeURIComponent(info.title)}&format=vtt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                    Web Captions
                  </span>
                  <span className="text-xs text-slate-400">WebVTT (.VTT)</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0" />
              </a>
            </div>
          </div>

          {/* Tertiary Section: Video Muted */}
          {withoutAudio.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                <VolumeX className="h-4 w-4 text-rose-400" />
                High Resolution - No Audio 🔇
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleVideoMuted.map((f, i) => (
                  <FormatRow
                    key={`vm-${i}`}
                    f={f}
                    title={info.title}
                    variant="grey"
                    onStartMerge={handleStartMerge}
                    disabled={startingJob}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Show All Toggle */}
          {(hasHidden || showAll) && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-500/20 hover:text-indigo-300"
              >
                {showAll ? (
                  <>
                    Show Less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show All {totalFormats} Qualities <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Modal */}
      {activeJob && (
        <DownloadProgressModal
          jobId={activeJob.jobId}
          title={activeJob.title}
          thumbnail={activeJob.thumbnail}
          qualityLabel={activeJob.qualityLabel}
          onClose={() => setActiveJob(null)}
        />
      )}
    </section>
  );
}

/* ── Format Row ─────────────────────────────── */
function FormatRow({
  f,
  title,
  variant,
  onStartMerge,
  disabled,
  turboMode = false,
}: {
  f: FormatInfo;
  title: string;
  variant: "green" | "purple" | "grey";
  onStartMerge: (quality: string, label: string) => void;
  disabled?: boolean;
  turboMode?: boolean;
}) {
  const size = fileSize(f.contentLength);
  const label = `${f.qualityLabel || f.quality} · ${f.container.toUpperCase()}`;
  const isMuted = f.hasVideo && !f.hasAudio;

  let btnClass = "";
  if (variant === "green") btnClass = "btn-green";
  else if (variant === "purple") btnClass = "btn-purple";
  else if (variant === "grey")
    btnClass =
      "bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 shadow-[0_0_15px_rgba(148,163,184,0.1)]";

  return (
    <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04]">
      {/* Info */}
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
          {label}
          {isMuted && (
            <span title="No Audio (Video Only)" className="text-rose-400">
              <VolumeX className="h-3.5 w-3.5" />
            </span>
          )}
        </span>
        {size && <span className="text-xs text-slate-500">{size}</span>}
      </div>

      {/* Download Action */}
      <div className="flex items-center gap-2">
        {f.requiresMerge ? (
          <button
            onClick={() => onStartMerge(f.quality, f.qualityLabel)}
            disabled={disabled}
            title={turboMode ? "High-Speed Turbo Download" : "Standard Speed Download"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
              turboMode && variant === "green"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)]"
                : btnClass
            }`}
          >
            {turboMode ? (
              <>
                <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300" />
                <span>Turbo ⚡</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>Normal</span>
              </>
            )}
          </button>
        ) : (
          <a
            href={buildProxyUrl(f.url, title, f.container)}
            title={isMuted ? "Download Video (No Audio)" : "Direct Download"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${btnClass}`}
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </a>
        )}
      </div>
    </div>
  );
}
