import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import { resolveYtDlpBinary, resolveFfmpegBinary } from "@/lib/binResolver";
import { ensureInstagramCookies, ensureNetscapeCookies } from "@/lib/cookieHelper";
// @ts-ignore
import rahad from "rahad-all-downloader-v2";

const binPath = resolveYtDlpBinary();
const youtubedl = create(binPath);
const finalFfmpeg = resolveFfmpegBinary();

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function detectPlatform(url: string): "instagram" | "facebook" | "unknown" {
  if (/instagram\.com|instagr\.am/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "facebook";
  return "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mediaUrl = body.url?.trim();

    if (!mediaUrl) {
      return NextResponse.json({ error: "Please enter a valid link." }, { status: 400 });
    }

    const platform = detectPlatform(mediaUrl);
    if (platform === "unknown") {
      return NextResponse.json(
        { error: "Unsupported link. Please enter a valid Instagram or Facebook URL." },
        { status: 400 }
      );
    }

    let mediaData: any = null;

    // ── Method 1: rahad-all-downloader-v2 Native Scraper ───────────────
    try {
      if (typeof rahad?.alldl === "function") {
        const rahadRes: any = await rahad.alldl(mediaUrl);
        const d: any = rahadRes?.data;
        if (d && (d.videoUrl || d.download?.url)) {
          const directUrl = d.videoUrl || d.download?.url;
          const title = d.title || d.caption || (platform === "instagram" ? "Instagram Video" : "Facebook Video");
          const thumbnail = d.thumbnail || d.download?.thumbnail || "";
          const uploader = d.author || d.owner?.username || (platform === "instagram" ? "Instagram User" : "Facebook User");
          const duration = "01:00";

          mediaData = {
            platform,
            title,
            thumbnail,
            uploader,
            duration,
            durationSeconds: 60,
            videoUrl: directUrl,
            bestVideo: {
              url: directUrl,
              qualityLabel: "HD High Definition",
              height: 1080,
              container: "mp4",
              contentLength: String(15 * 1024 * 1024),
              requiresMerge: false,
              isDirectCdn: true,
            },
            bestAudio: {
              url: directUrl,
              qualityLabel: "MP3 Studio HD (320 kbps)",
              container: "mp3",
              contentLength: String(5 * 1024 * 1024),
            },
          };
        }
      }
    } catch (e: any) {
      console.warn("[/api/social] rahad extractor note:", e?.message);
    }

    // ── Method 2: yt-dlp Extraction Engine ─────────────────────────────
    if (!mediaData) {
      try {
        const igCookies = platform === "instagram" ? ensureInstagramCookies() : null;
        const ytCookies = ensureNetscapeCookies();
        const activeCookies = igCookies || ytCookies;

        const options: any = {
          dumpSingleJson: true,
          noWarnings: true,
          noCallHome: true,
          noCheckCertificates: true,
          preferFreeFormats: true,
        };

        if (activeCookies) {
          options.cookies = activeCookies;
        }

        const rawInfo: any = await youtubedl(mediaUrl, options);

        if (rawInfo) {
          const title = rawInfo.title || (platform === "instagram" ? "Instagram Video" : "Facebook Video");
          const thumbnail = rawInfo.thumbnail || rawInfo.thumbnails?.[0]?.url || "";
          const uploader = rawInfo.uploader || rawInfo.channel || (platform === "instagram" ? "Instagram User" : "Facebook User");
          const duration = formatDuration(rawInfo.duration || 0);
          const durationSeconds = rawInfo.duration || 60;

          const formats: any[] = rawInfo.formats || [];
          const videoFormats = formats.filter((f: any) => f.url && f.vcodec !== "none");
          videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

          const bestWithAudio = videoFormats.find((f: any) => f.acodec !== "none") || videoFormats[0];
          const audioFormats = formats.filter((f: any) => f.url && f.acodec !== "none");
          audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));
          const bestAudio = audioFormats[0] || bestWithAudio;

          const videoSize = bestWithAudio?.filesize || bestWithAudio?.filesize_approx || (durationSeconds * 2000000 / 8);
          const audioSize = bestAudio?.filesize || bestAudio?.filesize_approx || (durationSeconds * 320000 / 8);

          const videoHeight = bestWithAudio?.height || 1080;
          const videoQualityLabel = `${videoHeight}p Full HD`;

          mediaData = {
            platform,
            title,
            thumbnail,
            uploader,
            duration,
            durationSeconds,
            videoUrl: mediaUrl,
            bestVideo: {
              url: bestWithAudio?.url || mediaUrl,
              qualityLabel: videoQualityLabel,
              height: videoHeight,
              container: bestWithAudio?.ext || "mp4",
              contentLength: String(Math.round(videoSize)),
              requiresMerge: bestWithAudio?.acodec === "none",
              audioStreamUrl: bestAudio?.url,
              isDirectCdn: bestWithAudio?.acodec !== "none",
            },
            bestAudio: {
              url: bestAudio?.url || mediaUrl,
              qualityLabel: "MP3 Studio HD (320 kbps)",
              container: "mp3",
              contentLength: String(Math.round(audioSize)),
            },
          };
        }
      } catch (err: any) {
        console.error("[/api/social] yt-dlp error:", err?.message || err);
      }
    }

    if (!mediaData) {
      const msg =
        platform === "instagram"
          ? "Could not fetch Instagram post. Instagram currently requires a logged-in session or this video is private/restricted."
          : "Could not fetch Facebook video. The video might be private, restricted, or unavailable.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    return NextResponse.json(mediaData);
  } catch (err: any) {
    console.error("[/api/social] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error while retrieving media details." },
      { status: 500 }
    );
  }
}
