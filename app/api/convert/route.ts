import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import { resolveYtDlpBinary, resolveFfmpegBinary } from "@/lib/binResolver";
import path from "path";
import fs from "fs";
import os from "os";

// Find dynamic ffmpeg and yt-dlp path (cross-platform Linux/Docker + Windows)
const finalFfmpegPath = resolveFfmpegBinary();
const binPath = resolveYtDlpBinary();
const youtubedl = create(binPath);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const title = searchParams.get("title") || "audio";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const safeTitle = title.replace(/[^\w\s\-().]/g, "").replace(/\s+/g, "_").trim();
  const baseId = `snapsave_audio_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const outputTemplate = path.join(os.tmpdir(), `${baseId}.%(ext)s`);
  const tempFilePath = path.join(os.tmpdir(), `${baseId}.mp3`);

  try {
    // Download and extract audio to MP3 using yt-dlp + ffmpeg
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      output: outputTemplate,
      noWarnings: true,
      ffmpegLocation: finalFfmpegPath || undefined,
      jsRuntimes: 'node',
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`Converted MP3 file was not created at ${tempFilePath}`);
    }

    const stat = fs.statSync(tempFilePath);
    const fileStream = fs.createReadStream(tempFilePath);

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => {
          controller.close();
          fs.unlink(tempFilePath, () => {});
        });
        fileStream.on("error", (err) => {
          controller.error(err);
          fs.unlink(tempFilePath, () => {});
        });
      },
      cancel() {
        fileStream.destroy();
        fs.unlink(tempFilePath, () => {});
      },
    });

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${safeTitle}.mp3"`);
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", stat.size.toString());

    return new Response(readableStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[/api/convert] Error:", error);
    if (fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }
    const errMsg = error?.stderr || error?.message || String(error);
    return NextResponse.json({ error: "Conversion to MP3 failed", details: errMsg }, { status: 500 });
  }
}
