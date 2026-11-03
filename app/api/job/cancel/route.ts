import { NextRequest, NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobManager";

export async function POST(req: NextRequest) {
  try {
    let jobId: string | null = null;

    try {
      const body = await req.json();
      jobId = body?.jobId;
    } catch (e) {
      const { searchParams } = new URL(req.url);
      jobId = searchParams.get("jobId");
    }

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const cancelled = cancelJob(jobId);
    return NextResponse.json({ success: cancelled });
  } catch (error: any) {
    console.error("[/api/job/cancel] Error:", error);
    return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 });
  }
}

