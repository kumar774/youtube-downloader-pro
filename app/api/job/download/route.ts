import { NextRequest, NextResponse } from "next/server";
import { getJob, cleanupJob } from "@/lib/jobManager";
import fs from "fs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const job = getJob(jobId);
  if (!job || !job.tempFilePath || !fs.existsSync(job.tempFilePath)) {
    return NextResponse.json({ error: "File not found or expired" }, { status: 404 });
  }

  const filePath = job.tempFilePath;
  const isAudio = job.type === "convert";
  const ext = isAudio ? "mp3" : "mp4";
  const contentType = isAudio ? "audio/mpeg" : "video/mp4";

  const rawTitle = (job.title || "download")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "")
    .trim();
  const asciiTitle = rawTitle.replace(/[^\x20-\x7E]/g, "").trim() || "download";
  const encodedTitle = encodeURIComponent(`${rawTitle || "download"}.${ext}`);

  try {
    const stat = fs.statSync(filePath);
    const totalSize = stat.size;

    // Check for Range request (essential for iOS Safari / WebKit)
    const rangeHeader = req.headers.get("range");

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize) {
        return new Response("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${totalSize}` },
        });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });

      const readableStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() {
          fileStream.destroy();
        },
      });

      const headers = new Headers();
      headers.set(
        "Content-Disposition",
        `attachment; filename="${asciiTitle}.${ext}"; filename*=UTF-8''${encodedTitle}`
      );
      headers.set("Content-Type", contentType);
      headers.set("Content-Range", `bytes ${start}-${end}/${totalSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

      return new Response(readableStream, {
        status: 206,
        headers,
      });
    }

    // Full file stream
    const fileStream = fs.createReadStream(filePath);

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    const headers = new Headers();
    headers.set(
      "Content-Disposition",
      `attachment; filename="${asciiTitle}.${ext}"; filename*=UTF-8''${encodedTitle}`
    );
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", totalSize.toString());
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache, no-store, must-revalidate");

    return new Response(readableStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("[/api/job/download] Error:", error);
    return NextResponse.json(
      { error: "Failed to stream file", details: error?.message },
      { status: 500 }
    );
  }
}

