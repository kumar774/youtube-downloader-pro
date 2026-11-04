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
  directCdnUrl?: string;
  videoStreamUrl?: string;
  audioStreamUrl?: string;
  hasAudio: boolean;
  hasVideo: boolean;
  contentLength?: string;
  mimeType?: string;
  requiresMerge?: boolean;
}

export interface SubtitleInfo {
  label: string;
  lang: string;
  url?: string;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: string;
  durationSeconds?: number;
  author: string;
  videoUrl: string;
  formats: {
    directWithAudio?: FormatInfo[];
    cinemaMerged?: FormatInfo[];
    standardMerged?: FormatInfo[];
    withAudio: FormatInfo[];
    withoutAudio?: FormatInfo[];
    audioOnly: FormatInfo[];
  };
  subtitles?: SubtitleInfo[];
}

/* ── Helpers ────────────────────────────────── */
function fileSize(bytes?: string) {
  if (!bytes) return "";
  const b = parseInt(bytes, 10);
  if (isNaN(b) || b <= 0) return "";
  const gb = b / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = b / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
}

function sanitizeFilename(title: string) {
  return title.replace(/[<>:"/\\|?*]+/g, "").trim();
}

function buildDirectDownloadUrl(f: FormatInfo, title: string, container: string) {
  const targetUrl = f.directCdnUrl || f.url;
  const params = new URLSearchParams({
    url: targetUrl,
    mode: "redirect",
    title: sanitizeFilename(title),
    ext: container,
  });
  return `/api/download?${params.toString()}`;
}

/* ── Component ──────────────────────────────── */
export default function VideoCard({ info }: { info: VideoInfo }) {
  const [showAllCinema, setShowAllCinema] = useState(false);
  const [selectedBitrate, setSelectedBitrate] = useState<"320k" | "192k" | "128k">("320k");
  const [turboMode, setTurboMode] = useState<boolean>(true);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState("");
  const [clipEnd, setClipEnd] = useState("");
  const [selectedSubtitleLang, setSelectedSubtitleLang] = useState<string>("en");

  const [activeJob, setActiveJob] = useState<{
    jobId: string;
    title: string;
    thumbnail?: string;
    qualityLabel?: string;
    totalSizeText?: string;
  } | null>(null);
  const [startingJob, setStartingJob] = useState(false);

  // Groupings
  const directFormats = info.formats?.directWithAudio || [];
  const cinemaFormats = info.formats?.cinemaMerged || [];
  const standardFormats = info.formats?.standardMerged || [];

  const audioOnly = info.formats?.audioOnly || [];
  const subtitlesList =
    info.subtitles && info.subtitles.length > 0
      ? info.subtitles
      : [{ label: "English", lang: "en" }];

  const visibleCinema =
    showAllCinema || cinemaFormats.length <= 6
      ? cinemaFormats
      : cinemaFormats.slice(0, 6);

  const handleStartMerge = async (
    formatId: string,
    qualityLabel: string,
    videoStreamUrl?: string,
    audioStreamUrl?: string,
    contentLength?: string
  ) => {
    if (startingJob) return;
    setStartingJob(true);

    try {
      const formatSelector = formatId.includes("+") ? formatId : `${formatId}+bestaudio`;
      const sizeText = fileSize(contentLength);
      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.videoUrl,
          videoStreamUrl,
          audioStreamUrl,
          contentLength,
          title: info.title,
          artist: info.author,
          format: formatSelector,
          type: "merge",
          thumbnail: info.thumbnail,
          qualityLabel: qualityLabel,
          durationSeconds: info.durationSeconds,
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
          totalSizeText: sizeText,
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
      const bestAudio = audioOnly[0];
      const audioStreamUrl = bestAudio?.url;
      const sizeText = fileSize(bestAudio?.contentLength);

      const res = await fetch("/api/job/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: info.videoUrl,
          audioStreamUrl,
          contentLength: bestAudio?.contentLength,
          title: info.title,
          artist: info.author,
          type: "convert",
          bitrate,
          thumbnail: info.thumbnail,
          qualityLabel: `MP3 ${bitrate.replace("k", " kbps")} Studio`,
          durationSeconds: info.durationSeconds,
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
          totalSizeText: sizeText,
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
    <section className="relative z-10 mx-auto w-full max-w-4xl px-3 sm:px-6 pb-16 animate-fade-in-up">
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
          <div className="flex flex-1 flex-col justify-center gap-3 p-4 sm:p-6 min-w-0">
            <div>
              <h2 className="text-base sm:text-xl font-bold leading-snug text-white line-clamp-2 break-words">
                {info.title}
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm text-slate-400">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{info.author}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Download Control Panel ───────────────────── */}
        <div className="border-t border-white/5 px-3.5 py-4 sm:px-6 sm:py-5">
          {/* Download Speed Mode Toggle Switch */}
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 rounded-xl border border-white/10 bg-gradient-to-r from-slate-900/90 via-slate-800/60 to-slate-900/90 p-3 sm:p-4 shadow-lg w-full">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div
                className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                  turboMode
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]"
                    : "border-slate-700 bg-slate-800/80 text-slate-400"
                }`}
              >
                <Zap
                  className={`h-5 w-5 sm:h-6 sm:w-6 transition-all ${
                    turboMode ? "animate-pulse fill-amber-400" : ""
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap">Download Engine Mode</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      turboMode
                        ? "bg-gradient-to-r from-amber-500/30 to-yellow-500/30 text-amber-300 border border-amber-500/40 shadow-sm"
                        : "bg-slate-700/60 text-slate-400 border border-slate-600/30"
                    }`}
                  >
                    {turboMode ? "⚡ Turbo Multi-Stream" : "Standard Mode"}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 line-clamp-1">
                  {turboMode
                    ? "High-speed 16-channel multi-stream buffer enabled"
                    : "Standard single-stream download"}
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 shrink-0">
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
                className={`relative inline-flex h-5 w-11 sm:h-6 sm:w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                  turboMode
                    ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                    : "bg-slate-700"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-300 ease-in-out ${
                    turboMode ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                onClick={() => setTurboMode(true)}
                className={`text-xs cursor-pointer select-none transition-colors ${
                  turboMode
                    ? "text-amber-400 font-extrabold flex items-center gap-1"
                    : "text-slate-400 hover:text-slate-300"
                }`}
              >
                Turbo ⚡
              </span>
            </div>
          </div>

          {/* Clip / Segment Cutter */}
          <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/60 p-3 sm:p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <Scissors className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">Smart Clip Cutter</span>
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300 uppercase">
                      New
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1">
                    Download only your favorite part (e.g. 00:00:30 to 00:01:45)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setClipEnabled(!clipEnabled)}
                className={`self-start sm:self-center px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                  clipEnabled
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-white/5 text-slate-400 border-white/10 hover:text-white"
                }`}
              >
                {clipEnabled ? "Trim Active ✓" : "+ Enable Cutter"}
              </button>
            </div>

            {clipEnabled && (
              <div className="mt-3.5 pt-3.5 border-t border-white/5 flex flex-wrap items-center gap-3 animate-fade-in">
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

          {/* ══════════════════════════════════════════════════════════════
              SECTION 1: Instant Fast Download (Ready with Audio)
             ══════════════════════════════════════════════════════════════ */}
          {directFormats.length > 0 && (
            <div className="mb-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
                <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-emerald-400 min-w-0">
                  <Film className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="truncate">Instant Fast Download (Ready with Audio) ⚡</span>
                </h3>
                <span className="self-start sm:self-auto text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                  Direct CDN · 20-50 MB/s
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {directFormats.map((f, i) => (
                  <FormatRow
                    key={`direct-${i}`}
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

          {/* ══════════════════════════════════════════════════════════════
              SECTION 2: Cinema & Ultra HD (1080p to 8K Auto-Merged)
             ══════════════════════════════════════════════════════════════ */}
          {cinemaFormats.length > 0 && (
            <div className="mb-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
                <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-blue-400 min-w-0">
                  <Film className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="truncate">Cinema & Ultra HD (1080p to 8K Auto-Merged) 🎬</span>
                </h3>
                <span className="self-start sm:self-auto text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap shrink-0">
                  Full Audio Sync
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCinema.map((f, i) => (
                  <FormatRow
                    key={`cinema-${i}`}
                    f={f}
                    title={info.title}
                    variant="blue"
                    onStartMerge={handleStartMerge}
                    disabled={startingJob}
                    turboMode={turboMode}
                  />
                ))}
              </div>

              {cinemaFormats.length > 6 && (
                <div className="mt-3.5 flex justify-center">
                  <button
                    onClick={() => setShowAllCinema((v) => !v)}
                    className="flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
                  >
                    {showAllCinema ? (
                      <>
                        Show Fewer Qualities <ChevronUp className="h-3.5 w-3.5" />
                      </>
                    ) : (
                      <>
                        Show All {cinemaFormats.length} HD Qualities{" "}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3: Standard & Mobile (720p - 144p Auto-Merged)
             ══════════════════════════════════════════════════════════════ */}
          {standardFormats.length > 0 && (
            <div className="mb-7">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
                <h3 className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold uppercase tracking-wider text-indigo-400 min-w-0">
                  <Film className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="truncate">Standard & Mobile (720p – 144p Auto-Merged) 📱</span>
                </h3>
                <span className="self-start sm:self-auto text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 whitespace-nowrap shrink-0">
                  Full Audio
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {standardFormats.map((f, i) => (
                  <FormatRow
                    key={`std-${i}`}
                    f={f}
                    title={info.title}
                    variant="indigo"
                    onStartMerge={handleStartMerge}
                    disabled={startingJob}
                    turboMode={turboMode}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              SECTION 3: MP3 Studio Converter
             ══════════════════════════════════════════════════════════════ */}
          <div className="mb-7">
            <div className="rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-950/40 via-slate-900/80 to-purple-950/40 p-4 sm:p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-base font-bold text-white flex items-center gap-2">
                    <Music className="h-4 w-4 text-purple-400" />
                    MP3 Studio Converter
                    <span className="bg-purple-500/20 text-purple-300 text-[10px] px-2 py-0.5 rounded-full uppercase font-extrabold border border-purple-500/30">
                      ID3 Tags Included
                    </span>
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Converts audio directly to MP3 with embedded Title, Artist, and Album metadata
                  </span>

                  {/* Bitrate Selector Pills - fully wrapping for small screens */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-xs text-slate-400 font-semibold mr-1">Quality:</span>
                    {(["320k", "192k", "128k"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setSelectedBitrate(b)}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg transition-all ${
                          selectedBitrate === b
                            ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.45)] border border-purple-400/50"
                            : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border border-white/5"
                        }`}
                      >
                        {b === "320k"
                          ? "320 kbps (Studio)"
                          : b === "192k"
                          ? "192 kbps"
                          : "128 kbps"}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleStartConvert(selectedBitrate)}
                  disabled={startingJob}
                  className={`w-full lg:w-auto flex shrink-0 items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-lg hover:scale-[1.02] disabled:opacity-50 ${
                    turboMode
                      ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-amber-500 text-white shadow-purple-500/30"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  {turboMode ? (
                    <>
                      <Zap className="h-4 w-4 text-amber-300 fill-amber-300 shrink-0" />
                      <span>Download MP3 (Turbo ⚡)</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 shrink-0" />
                      <span>Download MP3</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════
              SECTION 4: Subtitles & Lyrics Extractor
             ══════════════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h3 className="flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-400 min-w-0">
                <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                <span className="truncate">Subtitles & Lyrics Extractor</span>
              </h3>

              {/* Language Selector Dropdown */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs text-slate-400 font-medium">Language:</label>
                <select
                  value={selectedSubtitleLang}
                  onChange={(e) => setSelectedSubtitleLang(e.target.value)}
                  className="rounded-lg bg-black/60 border border-white/10 px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400"
                >
                  {subtitlesList.map((sub, i) => (
                    <option key={`sub-${i}`} value={sub.lang}>
                      {sub.label} ({sub.lang.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
              <a
                href={`/api/subtitles?url=${encodeURIComponent(
                  info.videoUrl
                )}&title=${encodeURIComponent(
                  info.title
                )}&lang=${selectedSubtitleLang}&format=txt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                    Clean Lyrics
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400">Plain Text (.TXT)</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0 ml-2" />
              </a>

              <a
                href={`/api/subtitles?url=${encodeURIComponent(
                  info.videoUrl
                )}&title=${encodeURIComponent(
                  info.title
                )}&lang=${selectedSubtitleLang}&format=srt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                    Time-synced (.SRT)
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400">Standard Players</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0 ml-2" />
              </a>

              <a
                href={`/api/subtitles?url=${encodeURIComponent(
                  info.videoUrl
                )}&title=${encodeURIComponent(
                  info.title
                )}&lang=${selectedSubtitleLang}&format=vtt`}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all group"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                    Web Captions (.VTT)
                  </span>
                  <span className="text-[11px] sm:text-xs text-slate-400">HTML5 / Web</span>
                </div>
                <Download className="h-4 w-4 text-cyan-400 shrink-0 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </div>

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
  variant: "green" | "blue" | "indigo" | "purple";
  onStartMerge: (
    quality: string,
    label: string,
    videoStreamUrl?: string,
    audioStreamUrl?: string,
    contentLength?: string
  ) => void;
  disabled?: boolean;
  turboMode?: boolean;
}) {
  const size = fileSize(f.contentLength);
  const label = `${f.qualityLabel || f.quality} · ${f.container.toUpperCase()}`;

  const mergeButtonGradient =
    variant === "indigo"
      ? "bg-gradient-to-r from-indigo-600 to-slate-700 hover:from-indigo-500 hover:to-slate-600 text-white shadow-[0_0_15px_rgba(99,102,241,0.35)]"
      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.35)]";

  return (
    <div className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 sm:px-3.5 sm:py-3 transition-colors hover:border-white/10 hover:bg-white/[0.04] gap-2">
      {/* Info */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white truncate">
          {label}
        </span>
        {size && <span className="text-[11px] sm:text-xs text-slate-400 truncate">{size}</span>}
      </div>

      {/* Download Action */}
      <div className="flex items-center gap-2 shrink-0">
        {f.requiresMerge ? (
          <button
            onClick={() =>
              onStartMerge(
                f.quality,
                f.qualityLabel,
                f.videoStreamUrl || f.url,
                f.audioStreamUrl,
                f.contentLength
              )
            }
            disabled={disabled}
            title={
              turboMode
                ? "High-Speed Turbo Audio Merge"
                : "Standard Audio Merge"
            }
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mergeButtonGradient} disabled:opacity-50 whitespace-nowrap`}
          >
            {turboMode ? (
              <>
                <Zap className="h-3.5 w-3.5 text-amber-300 fill-amber-300 shrink-0" />
                <span className="hidden xs:inline">Merge & Turbo ⚡</span>
                <span className="xs:hidden">Turbo ⚡</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xs:inline">Merge & Download</span>
                <span className="xs:hidden">Merge</span>
              </>
            )}
          </button>
        ) : (
          <a
            href={buildDirectDownloadUrl(f, title, f.container)}
            title="Instant Fast Download at full ISP speed"
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.35)] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden xs:inline">Fast 1-Click ⚡</span>
            <span className="xs:hidden">Fast ⚡</span>
          </a>
        )}
      </div>
    </div>
  );
}
