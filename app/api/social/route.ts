import { NextRequest, NextResponse } from "next/server";
import youtubedl from "youtube-dl-exec";
import { resolveYtDlpBinary } from "@/lib/binResolver";

const binPath = resolveYtDlpBinary();

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

    // Call extractor
    let rawInfo: any = null;
    try {
      rawInfo = await youtubedl(mediaUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noCallHome: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
      } as any);
    } catch (err: any) {
      console.error("[/api/social] Extractor error:", err?.message || err);
    }

    if (!rawInfo) {
      return NextResponse.json(
        {
          error:
            "Could not fetch media. The post might be private or temporarily restricted by the platform.",
        },
        { status: 404 }
      );
    }

    const title = rawInfo.title || (platform === "instagram" ? "Instagram Video" : "Facebook Video");
    const thumbnail = rawInfo.thumbnail || rawInfo.thumbnails?.[0]?.url || "";
    const uploader = rawInfo.uploader || rawInfo.channel || (platform === "instagram" ? "Instagram User" : "Facebook User");
    const duration = formatDuration(rawInfo.duration || 0);
    const durationSeconds = rawInfo.duration || 0;

    // Pick best combined video format or highest resolution format
    const formats: any[] = rawInfo.formats || [];
    const videoFormats = formats.filter(
      (f: any) => f.url && f.vcodec !== "none"
    );

    // Sort by height descending
    videoFormats.sort((a: any, b: any) => (b.height || 0) - (a.height || 0));

    // Find best video that already has audio or highest video
    const bestWithAudio = videoFormats.find((f: any) => f.acodec !== "none") || videoFormats[0];
    const audioFormats = formats.filter((f: any) => f.url && f.acodec !== "none");
    audioFormats.sort((a: any, b: any) => (b.abr || 0) - (a.abr || 0));
    const bestAudio = audioFormats[0] || bestWithAudio;

    const videoSize = bestWithAudio?.filesize || bestWithAudio?.filesize_approx || 0;
    const audioSize = bestAudio?.filesize || bestAudio?.filesize_approx || 0;

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
        contentLength: String(videoSize),
        requiresMerge: bestWithAudio?.acodec === "none",
        audioStreamUrl: bestAudio?.url,
      },
      bestAudio: {
        url: bestAudio?.url || mediaUrl,
        qualityLabel: "MP3 Studio HD (320 kbps)",
        container: "mp3",
        contentLength: String(audioSize || 5 * 1024 * 1024),
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

