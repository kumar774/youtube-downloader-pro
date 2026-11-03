import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import path from "path";
import fs from "fs";
import os from "os";
// Find dynamic ffmpeg path
const ffmpegExt = process.platform === "win32" ? ".exe" : "";
const resolvedFfmpegPath = path.resolve(
  process.cwd(),
  "node_modules/ffmpeg-static",
  `ffmpeg${ffmpegExt}`
);
const finalFfmpegPath = fs.existsSync(resolvedFfmpegPath) ? resolvedFfmpegPath : undefined;

// Find absolute path to yt-dlp binary
const ext = process.platform === 'win32' ? '.exe' : '';
const binPath = path.resolve(process.cwd(), `node_modules/youtube-dl-exec/bin/yt-dlp${ext}`);
const youtubedl = create(binPath);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const title = searchParams.get("title") || "video";
  const rawFormat = searchParams.get("f");
  const format = rawFormat || "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const safeTitle = title.replace(/[^\w\s\-().]/g, "").replace(/\s+/g, "_").trim();
  const baseId = `snapsave_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const outputTemplate = path.join(os.tmpdir(), `${baseId}.%(ext)s`);
  const tempFilePath = path.join(os.tmpdir(), `${baseId}.mp4`);

  try {
    // 1. Download and merge into temporary MP4 file using yt-dlp + ffmpeg
    await youtubedl(url, {
      format: format,
      output: outputTemplate,
      mergeOutputFormat: 'mp4',
      noWarnings: true,
      ffmpegLocation: finalFfmpegPath || undefined,
      jsRuntimes: 'node',
    });

    if (!fs.existsSync(tempFilePath)) {
      throw new Error(`Merged file was not created at ${tempFilePath}`);
    }

    const stat = fs.statSync(tempFilePath);
    const fileStream = fs.createReadStream(tempFilePath);

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => {
          controller.close();
          // Clean up temp file after streaming finishes
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
      }
    });

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${safeTitle}.mp4"`);
    headers.set("Content-Type", "video/mp4");
    headers.set("Content-Length", stat.size.toString());

    return new Response(readableStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[/api/merge] Error:", error);
    if (fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }
    const errMsg = error?.stderr || error?.message || String(error);
    return NextResponse.json({ error: "Merge failed", details: errMsg }, { status: 500 });
  }
}
