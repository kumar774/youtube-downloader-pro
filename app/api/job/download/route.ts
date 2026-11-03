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

  const safeTitle = (job.title || "download")
    .replace(/[^\w\s\-().]/g, "")
    .replace(/\s+/g, "_")
    .trim();

  try {
    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => {
          controller.close();
          // Clean up temp file and job entry after download completes
          setTimeout(() => cleanupJob(jobId), 1000);
        });
        fileStream.on("error", (err) => {
          controller.error(err);
          setTimeout(() => cleanupJob(jobId), 1000);
        });
      },
      cancel() {
        fileStream.destroy();
        cleanupJob(jobId);
      },
    });

    const headers = new Headers();
    headers.set("Content-Disposition", `attachment; filename="${safeTitle}.${ext}"`);
    headers.set("Content-Type", contentType);
    headers.set("Content-Length", stat.size.toString());

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

