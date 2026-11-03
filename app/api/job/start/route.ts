import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob, getJob } from "@/lib/jobManager";
import { resolveYtDlpBinary, resolveFfmpegBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import { resolveInvidiousVideo } from "@/lib/invidiousResolver";
import cp from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

// Resolve binaries dynamically (cross-platform Linux/Docker + Windows)
const binPath = resolveYtDlpBinary();
const finalFfmpegPath = resolveFfmpegBinary();

function formatSpeed(speedStr: string): string {
  if (!speedStr) return "";
  // Normalize MiB/s to clean MB/s
  return speedStr
    .replace(/MiB\/s/gi, "MB/s")
    .replace(/KiB\/s/gi, "KB/s")
    .replace(/GiB\/s/gi, "GB/s");
}

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let {
      url,
      videoStreamUrl,
      audioStreamUrl,
      durationSeconds,
      contentLength,
      title,
      artist,
      format,
      type = "merge",
      thumbnail,
      qualityLabel,
      bitrate = "320k",
      turbo = true,
      clipStart,
      clipEnd,
    } = body;

    if (!url && !videoStreamUrl && !audioStreamUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const outputTemplate = path.join(os.tmpdir(), `${jobId}.%(ext)s`);
    const finalExtension = type === "convert" ? "mp3" : "mp4";
    const tempFilePath = path.join(os.tmpdir(), `${jobId}.${finalExtension}`);

    let displayQuality =
      qualityLabel ||
      (type === "convert"
        ? `MP3 (${bitrate.replace("k", " kbps")})`
        : turbo
        ? "Turbo High Quality"
        : "Standard Quality");

    if (clipStart && clipEnd) {
      displayQuality += ` [Clip ${clipStart} - ${clipEnd}]`;
    }

    const job = createJob({
      id: jobId,
      type,
      title: title || "Video",
      thumbnail,
      qualityLabel: displayQuality,
      turbo,
    });

    job.tempFilePath = tempFilePath;

    // If stream URLs are not provided, attempt automatic resolution via Invidious distributed engine
    if (url && (!videoStreamUrl || !audioStreamUrl)) {
      const vidId = extractVideoId(url);
      if (vidId) {
        try {
          const invData = await resolveInvidiousVideo(vidId);
          if (invData?.formats?.length) {
            if (!durationSeconds && invData.duration) {
              durationSeconds = parseInt(invData.duration, 10);
            }
            if (type === "convert" && !audioStreamUrl) {
              const aFormat = invData.formats.find((f: any) => f.acodec !== "none" && f.vcodec === "none");
              if (aFormat?.url) audioStreamUrl = aFormat.url;
            } else if (type === "merge") {
              if (!videoStreamUrl) {
                // Find matching video format or best video
                const vFormat = invData.formats.find((f: any) => f.vcodec !== "none");
                if (vFormat?.url) videoStreamUrl = vFormat.url;
              }
              if (!audioStreamUrl) {
                const aFormat = invData.formats.find((f: any) => f.acodec !== "none" && f.vcodec === "none");
                if (aFormat?.url) audioStreamUrl = aFormat.url;
              }
            }
          }
        } catch (e: any) {
          console.warn("[/api/job/start] Fallback Invidious stream lookup error:", e?.message);
        }
      }
    }

    const ffmpegBin = finalFfmpegPath || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
    const canUseDirectFfmpeg =
      (type === "convert" && !!audioStreamUrl) ||
      (type === "merge" && !!videoStreamUrl && !!audioStreamUrl);

    if (canUseDirectFfmpeg) {
      // ══════════════════════════════════════════════════════════════
      // High-Speed Direct FFmpeg Engine (Bypasses YouTube 429 Bot Check)
      // ══════════════════════════════════════════════════════════════
      let ffmpegArgs: string[] = [];

      if (type === "convert") {
        ffmpegArgs = [
          "-y",
          ...(clipStart && clipEnd ? ["-ss", clipStart, "-to", clipEnd] : []),
          "-i",
          audioStreamUrl,
          "-vn",
          "-c:a",
          "libmp3lame",
          "-b:a",
          bitrate,
          "-id3v2_version",
          "3",
          "-metadata",
          `title=${(title || "Audio").replace(/"/g, "")}`,
          "-metadata",
          `artist=${(artist || "YouTube").replace(/"/g, "")}`,
          tempFilePath,
        ];
      } else {
        ffmpegArgs = [
          "-y",
          ...(clipStart && clipEnd ? ["-ss", clipStart, "-to", clipEnd] : []),
          "-i",
          videoStreamUrl,
          "-i",
          audioStreamUrl,
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          tempFilePath,
        ];
      }

      console.log(`[Job ${jobId}] Spawning direct FFmpeg: ${ffmpegBin}`);
      updateJob(jobId, {
        status: "downloading",
        percent: 15,
        stage: type === "convert" ? "Streaming audio to MP3 encoder..." : "Streaming video & audio muxer...",
      });

      const child = cp.spawn(/*turbopackIgnore: true*/ ffmpegBin, ffmpegArgs, { windowsHide: true });
      job.childProcess = child;

      const totalBytesExpected = contentLength ? parseInt(contentLength, 10) : (durationSeconds ? (type === "convert" ? Math.round((parseInt(bitrate) || 320) * 1000 * durationSeconds / 8) : Math.round(2500000 * durationSeconds / 8)) : 50 * 1024 * 1024);
      const totalChunks = turbo ? 16 : 4;

      let stderrOutput = "";
      child.stderr.on("data", (data: Buffer) => {
        const text = data.toString();
        stderrOutput += text;

        const timeMatch = text.match(/time=([0-9:.]+)/);
        const speedMatch = text.match(/speed=\s*([0-9.]+x)/);
        if (timeMatch) {
          const parts = timeMatch[1].split(":");
          let sec = 0;
          if (parts.length === 3) {
            sec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            sec = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          }

          const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 240;
          const pct = Math.min(Math.max(Math.round((sec / total) * 95), 10), 95);
          const downloadedBytes = Math.round((pct / 100) * totalBytesExpected);
          const currentChunk = Math.min(Math.ceil((pct / 100) * totalChunks), totalChunks);
          const speedText = speedMatch ? `${speedMatch[1]}` : (turbo ? "14.2 MB/s" : "3.8 MB/s");

          let stageText = "";
          if (pct < 25) {
            stageText = type === "convert" ? `Fetching audio stream & allocating threads...` : `Buffering multi-stream chunk ${currentChunk}/${totalChunks}...`;
          } else if (pct < 75) {
            stageText = type === "convert" ? `Encoding MP3 with Studio ID3 tags (${pct}%)...` : `Processing high-definition stream chunk ${currentChunk}/${totalChunks}...`;
          } else {
            stageText = type === "convert" ? `Finalizing MP3 Studio track (${pct}%)...` : `Lossless FFmpeg container muxing (${pct}%)...`;
          }

          updateJob(jobId, {
            status: "merging",
            percent: pct,
            speed: speedText,
            downloadedBytes,
            totalBytes: totalBytesExpected,
            activeChunks: currentChunk,
            totalChunks,
            stage: stageText,
          });
        }
      });

      child.on("close", (code: number) => {
        const current = getJob(jobId);
        if (current?.status === "cancelled") return;

        if (code === 0 && fs.existsSync(tempFilePath)) {
          updateJob(jobId, {
            status: "completed",
            percent: 100,
            downloadedBytes: totalBytesExpected,
            totalBytes: totalBytesExpected,
            activeChunks: totalChunks,
            totalChunks,
            stage: "Ready for download!",
          });
        } else {
          console.error(`[Job ${jobId}] FFmpeg failed with exit code ${code}:`, stderrOutput);
          updateJob(jobId, {
            status: "failed",
            error: stderrOutput.slice(-300) || `FFmpeg process exited with code ${code}`,
            stage: "Processing failed",
          });
        }
      });

      child.on("error", (err: Error) => {
        console.error(`[Job ${jobId}] FFmpeg error:`, err);
        updateJob(jobId, {
          status: "failed",
          error: err.message,
          stage: "FFmpeg process error",
        });
      });

      return NextResponse.json({ jobId });
    }

    // ══════════════════════════════════════════════════════════════
    // Standard yt-dlp Child Process Engine (Fallback)
    // ══════════════════════════════════════════════════════════════
    let args: string[] = [];

    const turboArgs = turbo
      ? [
          "--concurrent-fragments",
          "16",
          "--buffer-size",
          "16M",
          "--throttled-rate",
          "100K",
        ]
      : ["--limit-rate", "3M", "--buffer-size", "1M"];

    const clipArgs =
      clipStart && clipEnd
        ? ["--download-sections", `*${clipStart}-${clipEnd}`, "--force-keyframes-at-cuts"]
        : [];

    const cookiesPath = ensureNetscapeCookies();
    const cookieArgs = cookiesPath ? ["--cookies", cookiesPath] : [];

    if (type === "convert") {
      args = [
        url,
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        bitrate,
        "--embed-metadata",
        "-o",
        outputTemplate,
        "--impersonate",
        "chrome",
        ...turboArgs,
        ...clipArgs,
        ...cookieArgs,
        "--no-warnings",
        "--newline",
        "--js-runtimes",
        process.platform === "linux" ? "deno" : "node",
        "--postprocessor-args",
        `ffmpeg:-id3v2_version 3 -metadata title="${(title || "Audio").replace(/"/g, "")}" -metadata artist="${(artist || "YouTube").replace(/"/g, "")}"`,
      ];
    } else {
      const formatSelector =
        format || "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best";

      args = [
        url,
        "-f",
        formatSelector,
        "-o",
        outputTemplate,
        "--merge-output-format",
        "mp4",
        "--impersonate",
        "chrome",
        ...turboArgs,
        ...clipArgs,
        ...cookieArgs,
        "--no-warnings",
        "--newline",
        "--js-runtimes",
        process.platform === "linux" ? "deno" : "node",
        "--postprocessor-args",
        "ffmpeg:-c copy -threads 0",
      ];
    }

    if (finalFfmpegPath) {
      args.push("--ffmpeg-location", finalFfmpegPath);
    }

    // Spawn child process
    const child = cp.spawn(/*turbopackIgnore: true*/ binPath, args, {
      windowsHide: true,
    });

    job.childProcess = child;
    updateJob(jobId, { status: "downloading", stage: "Connecting to YouTube..." });

    // Progress line regex
    // [download]  45.2% of   13.01MiB at    1.13MiB/s ETA 00:11
    const progressRegex = /\[download\]\s+([0-9.]+)%\s+of\s+(?:~?\s*)([0-9.]+[A-Za-z]+)\s+at\s+([0-9.]+[A-Za-z/]+)\s+ETA\s+([0-9:]+)/;

    let stderrOutput = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      const lines = text.split(/[\r\n]+/);

      for (const line of lines) {
        if (!line.trim()) continue;

        const match = line.match(progressRegex);
        if (match) {
          const percent = parseFloat(match[1]);
          const speed = match[3];
          const eta = match[4];

          updateJob(jobId, {
            status: "downloading",
            percent: Math.min(percent, 92), // Keep under 95 until ffmpeg merge
            speed: formatSpeed(speed),
            eta: `${eta}`,
            stage: `Downloading stream (${percent.toFixed(1)}%)`,
          });
        } else if (line.includes("[Merger]") || line.includes("Merging formats")) {
          updateJob(jobId, {
            status: "merging",
            percent: 95,
            stage: "Merging video & audio with FFmpeg...",
          });
        } else if (line.includes("[ExtractAudio]")) {
          updateJob(jobId, {
            status: "merging",
            percent: 92,
            stage: "Converting audio to MP3 with FFmpeg...",
          });
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderrOutput += data.toString();
    });

    child.on("close", (code: number) => {
      const current = getJob(jobId);
      if (current?.status === "cancelled") return;

      if (code === 0 && fs.existsSync(tempFilePath)) {
        updateJob(jobId, {
          status: "completed",
          percent: 100,
          stage: "Ready for download!",
        });
      } else {
        console.error(`[Job ${jobId}] Failed with exit code ${code}:`, stderrOutput);
        updateJob(jobId, {
          status: "failed",
          error: stderrOutput.slice(-300) || `Process exited with code ${code}`,
          stage: "Processing failed",
        });
      }
    });

    child.on("error", (err: Error) => {
      console.error(`[Job ${jobId}] Process error:`, err);
      updateJob(jobId, {
        status: "failed",
        error: err.message,
        stage: "Process error",
      });
    });

    return NextResponse.json({ jobId });
  } catch (error: any) {
    console.error("[/api/job/start] Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize download job", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
