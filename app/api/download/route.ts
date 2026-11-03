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
  const mode = searchParams.get("mode");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    let directCdnUrl = "";

    // Any direct HTTP stream (Invidious latest_version, direct CDN, googlevideo.com)
    if (targetUrl.startsWith("http") && !targetUrl.includes("youtube.com/watch") && !targetUrl.includes("youtu.be/")) {
      directCdnUrl = targetUrl;
    } else {
      // Fallback: Resolve YouTube page URL using yt-dlp or Invidious
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

    // Fast 302 Redirect Mode: Connects user directly to Google CDN for 20-50 MB/s download speed with 0 server load
    if (mode === "redirect" && directCdnUrl) {
      const redirectUrl = directCdnUrl.includes("googlevideo.com")
        ? `${directCdnUrl}&title=${encodeURIComponent(title)}`
        : directCdnUrl;
      return NextResponse.redirect(redirectUrl, 302);
    }

    // Proxy the stream from the direct CDN / Invidious proxy stream URL
    const reqRange = req.headers.get("range");
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (reqRange) {
      fetchHeaders["Range"] = reqRange;
    }

    const response = await fetch(directCdnUrl, {
      headers: fetchHeaders,
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Failed to fetch video stream from CDN. Status: ${response.status}` },
        { status: 500 }
      );
    }

    const contentType = ext === "webm" ? "video/webm" : ext === "m4a" ? "audio/mp4" : ext === "mp3" ? "audio/mpeg" : "video/mp4";
    const headers = new Headers({
      "Content-Disposition": `attachment; filename="${encodeURIComponent(title)}.${ext}"`,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    });

    const contentLength = response.headers.get("content-length");
    if (contentLength) {
      headers.set("Content-Length", contentLength);
    }
    const contentRange = response.headers.get("content-range");
    if (contentRange) {
      headers.set("Content-Range", contentRange);
    }

    return new NextResponse(response.body, {
      status: response.status === 206 ? 206 : 200,
      headers: headers,
    });
  } catch (error: any) {
    console.error("[/api/download] Proxy error:", error);
    return NextResponse.json({ error: "Proxy download failed", details: error.message }, { status: 500 });
  }
}
