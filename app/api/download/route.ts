import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { resolveInvidiousVideo } from "@/lib/invidiousResolver";
import path from "path";

// Find absolute path to yt-dlp binary (cross-platform Linux/Docker + Windows)
const binPath = resolveYtDlpBinary();
const youtubedl = create(binPath);

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");
  const itagParam = searchParams.get("itag");
  const title = searchParams.get("title") || "video";
  const ext = searchParams.get("ext") || "mp4";

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let directCdnUrl = "";

    if (targetUrl.includes("googlevideo.com")) {
      directCdnUrl = targetUrl;
    } else {
      // Fallback: Resolve YouTube page URL using yt-dlp
      if (!itagParam) {
        return NextResponse.json({ error: "Missing itag for YouTube page URL" }, { status: 400 });
      }

      let info: any = null;
      try {
        info = await youtubedl(targetUrl, {
          dumpJson: true,
          noWarnings: true,
          noCheckCertificates: true,
          preferFreeFormats: true,
          impersonate: "chrome",
        } as any);
      } catch {
        const vidId = extractVideoId(targetUrl);
        if (vidId) {
          info = await resolveInvidiousVideo(vidId);
        }
      }

      const matchedFormat = info?.formats?.find((f: any) => f.format_id === itagParam);
      if (!matchedFormat || !matchedFormat.url) {
        return NextResponse.json({ error: `Format ${itagParam} not found for this video` }, { status: 404 });
      }

      directCdnUrl = matchedFormat.url;
    }

    // Proxy the stream from the direct CDN URL
    const response = await fetch(directCdnUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch video stream from CDN. Status: ${response.status}` },
        { status: 500 }
      );
    }

    const contentType = ext === "webm" ? "video/webm" : ext === "m4a" ? "audio/mp4" : ext === "mp3" ? "audio/mpeg" : "video/mp4";
    const headers = new Headers({
      "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.${ext}"`,
      "Content-Type": contentType,
    });

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: headers,
    });
  } catch (error: any) {
    console.error("[/api/download] Proxy error:", error);
    return NextResponse.json({ error: "Proxy download failed", details: error.message }, { status: 500 });
  }
}
