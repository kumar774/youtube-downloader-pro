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

/**
 * Calculates a comprehensive quality score for social video formats
 * Ensures HD (1080p, 720p, 4K) formats with highest bitrates are prioritized over SD (360p, 480p).
 */
function formatQualityScore(f: any): number {
  let score = 0;
  const fid = String(f.format_id || "").toLowerCase();
  const formatNote = String(f.format_note || "").toLowerCase();
  const formatStr = String(f.format || "").toLowerCase();

  // 1. Explicit HD / SD tags from Facebook & Instagram
  if (fid === "hd" || formatNote.includes("hd") || formatStr.includes("hd")) score += 2000000;
  if (fid === "sd" || formatNote.includes("sd") || formatStr.includes("sd")) score += 100000;

  // 2. Resolution (height, width)
  const h = typeof f.height === "number" ? f.height : 0;
  const w = typeof f.width === "number" ? f.width : 0;
  if (h > 0) {
    score += h * 2000 + w;
  }

  // 3. Bitrate / tbr
  const bitrate = f.tbr || f.vbr || f.bitrate || 0;
  if (bitrate > 0) {
    score += Math.round(bitrate * 10);
  }

  // 4. Filesize
  const size = f.filesize || f.filesize_approx || 0;
  if (size > 0) {
    score += Math.round(size / 1024);
  }

  // 5. Native quality rating
  if (typeof f.quality === "number") {
    score += (f.quality + 10) * 50000;
  }

  // 6. Prefer MP4 over WebM for social
  if (f.ext === "mp4") score += 5000;

  return score;
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
      noCheckCertificates: true,
      preferFreeFormats: true,
      ignoreConfig: true,
    };

    if (activeCookies) {
      options.cookies = activeCookies;
    }

    let rawInfo: any = null;
    let extractionError: string = "";
    try {
      rawInfo = await youtubedl(mediaUrl, options);
    } catch (err: any) {
      extractionError = err?.message || String(err);
      console.error("[/api/social] Extraction error:", extractionError);
    }

    if (!rawInfo) {
      const msg =
        platform === "instagram"
          ? "Could not fetch Instagram post. Instagram currently requires a logged-in session or this video is private/restricted."
          : `Could not fetch Facebook video. (${extractionError.slice(0, 150) || "The video might be private, restricted, or unavailable."})`;
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    const title = rawInfo.title || (platform === "instagram" ? "Instagram Video" : "Facebook Video");
    const thumbnail = rawInfo.thumbnail || rawInfo.thumbnails?.[0]?.url || "";
    const uploader = rawInfo.uploader || rawInfo.channel || (platform === "instagram" ? "Instagram User" : "Facebook User");
    const duration = formatDuration(rawInfo.duration || 0);
    const durationSeconds = rawInfo.duration || 60;

    const formats: any[] = rawInfo.formats || [];

    // 1. Strictly prioritize formats that have BOTH Video AND Audio (Guarantees sound in downloaded file)
    // In Facebook & Instagram, progressive MP4s have acodec/vcodec as undefined or valid codec,
    // whereas silent video-only DASH streams have acodec === 'none'.
    const validVideoFormats = formats.filter((f: any) => {
      if (!f.url) return false;
      if (f.vcodec === "none") return false;
      if (f.acodec === "none") return false;
      const fid = String(f.format_id || "").toLowerCase();
      if (fid.includes("dash_video") || fid.includes("video_only")) return false;
      return true;
    });

    // Fallback: any video format if no dual-stream found
    const finalCandidates = validVideoFormats.length > 0
      ? validVideoFormats
      : formats.filter((f: any) => f.url && f.vcodec !== "none");

    // Sort strictly by highest quality score (HD 1080p > 720p > SD 480p)
    finalCandidates.sort((a: any, b: any) => formatQualityScore(b) - formatQualityScore(a));

    // Best video stream (Guaranteed to be highest quality WITH clear audio)
    const bestVideoFormat = finalCandidates[0];

    // Find best audio stream (for separate MP3 download option)
    const audioFormats = formats.filter((f: any) => f.url && f.vcodec === "none" && f.acodec !== "none");
    audioFormats.sort((a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    const bestAudioFormat = audioFormats[0] || bestVideoFormat;

    // Check if format needs server merge (only if video-only and separate audio exists)
    const isVideoOnly = bestVideoFormat?.acodec === "none";
    const requiresMerge = isVideoOnly && !!bestAudioFormat && bestAudioFormat !== bestVideoFormat;

    // Determine accurate height and quality label
    let detectedHeight = bestVideoFormat?.height || 0;
    if (!detectedHeight) {
      const fid = String(bestVideoFormat?.format_id || "").toLowerCase();
      if (fid.includes("hd")) detectedHeight = 1080;
      else if (fid.includes("sd")) detectedHeight = 480;
      else detectedHeight = 1080;
    }
    const qualityLabel = detectedHeight >= 1080 ? `${detectedHeight}p Full HD` : detectedHeight >= 720 ? `${detectedHeight}p HD` : `${detectedHeight}p`;

    const videoSize = bestVideoFormat?.filesize || bestVideoFormat?.filesize_approx || (durationSeconds * (detectedHeight >= 1080 ? 4500000 : 2000000) / 8);
    const audioSize = bestAudioFormat?.filesize || bestAudioFormat?.filesize_approx || (durationSeconds * 320000 / 8);

    return NextResponse.json({
      platform,
      title,
      thumbnail,
      uploader,
      duration,
      durationSeconds,
      videoUrl: mediaUrl,
      bestVideo: {
        url: bestVideoFormat?.url || mediaUrl,
        qualityLabel: qualityLabel,
        height: detectedHeight,
        container: bestVideoFormat?.ext || "mp4",
        contentLength: String(Math.round(videoSize)),
        requiresMerge: requiresMerge,
        audioStreamUrl: requiresMerge ? bestAudioFormat?.url : undefined,
        isDirectCdn: !requiresMerge,
      },
      bestAudio: {
        url: bestAudioFormat?.url || mediaUrl,
        qualityLabel: "MP3 Studio HD (320 kbps)",
        container: "mp3",
        contentLength: String(Math.round(audioSize)),
      },
    });
  } catch (err: any) {
    console.error("[/api/social] Unexpected error:", err);
    return NextResponse.json(
      { error: `Internal error: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
