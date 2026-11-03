import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob, getJob } from "@/lib/jobManager";
import { resolveYtDlpBinary, resolveFfmpegBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url,
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

    if (!url) {
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
    const child = cp.spawn(binPath, args, {
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

