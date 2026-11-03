import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureInstagramCookies, ensureNetscapeCookies } from "@/lib/cookieHelper";

const binPath = resolveYtDlpBinary();
const youtubedl = create(binPath);

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

    // Prepare cookies if configured
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

    let rawInfo: any = null;
    try {
      rawInfo = await youtubedl(mediaUrl, options);
    } catch (err: any) {
      console.error("[/api/social] Extraction error:", err?.message || err);
    }

    if (!rawInfo) {
      const msg =
        platform === "instagram"
          ? "Could not fetch Instagram post. Instagram currently requires a logged-in session or this video is private/restricted."
          : "Could not fetch Facebook video. The video might be private, restricted, or unavailable.";
      return NextResponse.json({ error: msg }, { status: 404 });
    }

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

    return NextResponse.json({
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
    });
  } catch (err: any) {
    console.error("[/api/social] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error while retrieving media details." },
      { status: 500 }
    );
  }
}
