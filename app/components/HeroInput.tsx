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
    <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pt-16 pb-8 sm:pt-24 sm:px-6">
      {/* Badge */}
      <div className="animate-fade-in-up mb-6 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-300">
          <Sparkles className="h-3.5 w-3.5" />
          Fast, Free & Unlimited YouTube Downloads
        </span>
      </div>

      {/* Heading */}
      <h1 className="animate-fade-in-up-delay-1 text-center text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
        Download YouTube Videos
        <br />
        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent animate-gradient">
          at Lightning Speed
        </span>
      </h1>

      <p className="animate-fade-in-up-delay-2 mx-auto mt-5 max-w-xl text-center text-base text-slate-400 sm:text-lg">
        Paste any YouTube link and download high-quality videos and audio instantly.
      </p>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="animate-fade-in-up-delay-3 mt-10 flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
          <input
            id="yt-url-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (validationError) setValidationError("");
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="input-glow w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500/50 sm:text-base"
            disabled={loading}
            autoFocus
          />
        </div>
        <button
          id="fetch-btn"
          type="submit"
          disabled={loading}
          className="btn-primary flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold sm:text-base disabled:opacity-60 disabled:cursor-not-allowed"
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
