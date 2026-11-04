"use client";

import React, { useState, useCallback } from "react";
import { Search, Loader2, Link2, Sparkles } from "lucide-react";

interface HeroInputProps {
  onFetch: (url: string) => Promise<void>;
  loading: boolean;
}

const YT_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

export default function HeroInput({ onFetch, loading }: HeroInputProps) {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) {
        setValidationError("Please paste a YouTube URL");
        return;
      }
      if (!YT_REGEX.test(trimmed)) {
        setValidationError("Invalid YouTube URL — please check and try again");
        return;
      }
      setValidationError("");
      await onFetch(trimmed);
    },
    [url, onFetch]
  );

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-3 sm:px-6 pt-10 pb-6 sm:pt-20 sm:pb-8">
      {/* Badge */}
      <div className="animate-fade-in-up mb-5 flex justify-center">
        <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 sm:px-4 sm:py-1.5 text-[11px] sm:text-xs font-medium text-indigo-300 text-center">
          <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span>Fast, Free & Unlimited YouTube Downloads</span>
        </span>
      </div>

      {/* Heading */}
      <h1 className="animate-fade-in-up-delay-1 text-center text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight px-1 break-words">
        Download YouTube Videos
        <br />
        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
          at Lightning Speed
        </span>
      </h1>

      <p className="animate-fade-in-up-delay-2 mx-auto mt-3.5 sm:mt-5 max-w-xl text-center text-xs sm:text-base text-slate-400 px-2 leading-relaxed">
        Paste any YouTube link and download high-quality videos and audio instantly.
      </p>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in-up-delay-3 mt-6 sm:mt-10 flex flex-col gap-2.5 sm:flex-row w-full max-w-2xl mx-auto"
      >
        <div className="relative flex-1 min-w-0">
          <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 sm:h-5 sm:w-5 -translate-y-1/2 text-slate-500" />
          <input
            id="yt-url-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input-glow w-full rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-3 sm:py-3.5 sm:pl-12 sm:pr-4 text-xs sm:text-base text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/50"
            disabled={loading}
            autoFocus
          />
        </div>
        <button
          id="fetch-btn"
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center justify-center gap-2 rounded-xl sm:rounded-2xl px-6 py-3 sm:px-7 sm:py-3.5 text-xs sm:text-base font-bold disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin-slow" />
              <span>Processing…</span>
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              <span>Download</span>
            </>
          )}
        </button>
      </form>

      {/* Validation error */}
      {validationError && (
        <p className="mt-3 text-center text-sm font-medium text-red-400 animate-fade-in-up">
          {validationError}
        </p>
      )}

      {/* Loading subtext */}
      {loading && (
        <div className="mt-6 flex flex-col items-center gap-3 animate-fade-in-up">
          <div className="h-1 w-48 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-full animate-shimmer rounded-full" />
          </div>
          <p className="text-sm text-slate-500">
            Extracting download links…
          </p>
        </div>
      )}
    </section>
  );
}
