import { NextRequest } from "next/server";
import { getJob } from "@/lib/jobManager";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return new Response("Missing jobId parameter", { status: 400 });
  }

  const job = getJob(jobId);
  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state immediately
      const initialPayload = {
        id: job.id,
        status: job.status,
        percent: job.percent,
        stage: job.stage,
        speed: job.speed,
        eta: job.eta,
        error: job.error,
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        controller.close();
        return;
      }

      const listener = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
            job.listeners.delete(listener);
            controller.close();
          }
        } catch (e) {
          job.listeners.delete(listener);
        }
      };

      job.listeners.add(listener);

      req.signal.addEventListener("abort", () => {
        job.listeners.delete(listener);
      });
    },
    cancel() {
      // Stream cancelled by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

