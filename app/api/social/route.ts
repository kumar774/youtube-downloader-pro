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

function detectPlatform(url: string): "instagram" | "facebook" | "tiktok" | "unknown" {
  if (/instagram\.com|instagr\.am/i.test(url)) return "instagram";
  if (/facebook\.com|fb\.watch|fb\.com/i.test(url)) return "facebook";
  if (/tiktok\.com|tikwm\.com/i.test(url)) return "tiktok";
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
        { error: "Unsupported link. Please enter a valid Instagram, Facebook, or TikTok URL." },
        { status: 400 }
      );
    }

    // ── Dedicated High-Speed TikTok Engine (No-Watermark 1080p + MP3) ──
    if (platform === "tiktok") {
      const tikDomains = ["https://www.tikwm.com/api/", "https://tikwm.com/api/"];
      let tikData: any = null;

      for (const endpoint of tikDomains) {
        try {
          const tikRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept": "application/json",
            },
            body: new URLSearchParams({ url: mediaUrl, hd: "1" }).toString(),
            signal: AbortSignal.timeout(8000),
          });
          const text = await tikRes.text();
          try {
            const parsed = JSON.parse(text);
            if (parsed.code === 0 && parsed.data) {
              tikData = parsed.data;
              break;
            }
          } catch {}
        } catch (endpointErr: any) {
          console.warn(`[/api/social] TikWM error at ${endpoint}:`, endpointErr?.message);
        }
      }

      if (tikData) {
        const d = tikData;
        const title = d.title || "TikTok Video";
        const thumbnail = d.cover || d.origin_cover || "";
        const uploader = d.author?.nickname || d.author?.unique_id || "TikTok Creator";
        const durationSec = d.duration || 30;
        const duration = formatDuration(durationSec);

        const hdUrl = d.hdplay ? (d.hdplay.startsWith("http") ? d.hdplay : `https://www.tikwm.com${d.hdplay}`) : null;
        const playUrl = d.play ? (d.play.startsWith("http") ? d.play : `https://www.tikwm.com${d.play}`) : null;
        const wmUrl = d.wmplay ? (d.wmplay.startsWith("http") ? d.wmplay : `https://www.tikwm.com${d.wmplay}`) : null;
        const musicUrl = d.music ? (d.music.startsWith("http") ? d.music : `https://www.tikwm.com${d.music}`) : (playUrl || mediaUrl);

        const videoFormats: any[] = [];
        if (hdUrl) {
          videoFormats.push({
            itag: "hd_no_watermark",
            qualityLabel: "1080p Full HD (No Watermark)",
            height: 1080,
            container: "mp4",
            url: hdUrl,
            contentLength: String(d.hd_size || d.size || Math.round(durationSec * 3500000 / 8)),
            requiresMerge: false,
            isDirectCdn: true,
            badge: "No Watermark",
          });
        }

        if (playUrl) {
          videoFormats.push({
            itag: "sd_no_watermark",
            qualityLabel: "Original Quality (No Watermark)",
            height: 720,
            container: "mp4",
            url: playUrl,
            contentLength: String(d.size || Math.round(durationSec * 2000000 / 8)),
            requiresMerge: false,
            isDirectCdn: true,
            badge: "Clean MP4",
          });
        }

        if (wmUrl) {
          videoFormats.push({
            itag: "with_watermark",
            qualityLabel: "Original (With Watermark)",
            height: 720,
            container: "mp4",
            url: wmUrl,
            contentLength: String(d.wm_size || d.size || Math.round(durationSec * 1800000 / 8)),
            requiresMerge: false,
            isDirectCdn: true,
            badge: "Watermarked",
          });
        }

        if (videoFormats.length > 0) {
          return NextResponse.json({
            platform: "tiktok",
            title,
            thumbnail,
            uploader,
            duration,
            durationSeconds: durationSec,
            videoUrl: mediaUrl,
            videoFormats,
            bestVideo: videoFormats[0],
            bestAudio: {
              url: musicUrl,
              qualityLabel: d.music_info?.title ? `MP3 · ${d.music_info.title}` : "MP3 Audio Track (Original Sound)",
              container: "mp3",
              contentLength: String(Math.round(durationSec * 320000 / 8)),
            },
          });
        }
      }
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

    // 1. Find best audio stream (for separate audio download or merging with DASH video)
    const audioFormats = formats.filter((f: any) => f.url && f.vcodec === "none" && f.acodec !== "none");
    audioFormats.sort((a: any, b: any) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0));
    const bestAudioFormat = audioFormats[0] || formats.find((f: any) => f.url && f.acodec && f.acodec !== "none");

    // 2. Identify all valid video candidates (both DASH video-only and progressive video+audio)
    const videoCandidates = formats.filter((f: any) => f.url && f.vcodec !== "none");
    const candidates = videoCandidates.length > 0
      ? videoCandidates
      : formats.filter((f: any) => f.url && f.acodec !== f.format_id);

    const candidateMap = new Map<string, any>();

    for (const f of candidates) {
      let h = typeof f.height === "number" ? f.height : 0;
      let w = typeof f.width === "number" ? f.width : 0;
      const fid = String(f.format_id || "").toLowerCase();
      const fnote = String(f.format_note || "").toLowerCase();

      if (!h) {
        if (fid === "hd" || fnote.includes("hd") || fid.includes("1080")) h = 1080;
        else if (fid.includes("720")) h = 720;
        else if (fid === "sd" || fnote.includes("sd") || fid.includes("480")) h = 480;
        else h = 720;
      }

      // Dynamic resolution calculation for both horizontal (16:9) and vertical (9:16 reels/shorts)
      // For vertical videos (e.g. 1080x1920), the true quality standard is the width (1080p)
      const trueRes = (w > 0 && h > 0) ? Math.min(w, h) : h;

      let label = "";
      if (trueRes >= 2160) label = "4K Ultra HD";
      else if (trueRes >= 1440) label = "1440p 2K QHD";
      else if (trueRes >= 1080) label = "1080p Full HD";
      else if (trueRes >= 720) label = "720p HD";
      else if (trueRes >= 480) label = "480p SD";
      else label = `${trueRes}p`;

      const hasAudioNatively = f.acodec !== "none" && (f.acodec !== undefined || fid === "hd" || fid === "sd");
      const requiresMerge = !hasAudioNatively && !!bestAudioFormat;
      const audioUrl = requiresMerge ? bestAudioFormat.url : undefined;

      const size = f.filesize || f.filesize_approx || Math.round(durationSeconds * (h >= 1080 ? 4500000 : h >= 720 ? 2500000 : 1000000) / 8);

      const entry = {
        itag: f.format_id || label,
        qualityLabel: label,
        height: h,
        width: w,
        container: f.ext || "mp4",
        url: f.url,
        contentLength: String(size),
        requiresMerge,
        audioStreamUrl: audioUrl,
        isDirectCdn: !requiresMerge,
      };

      if (!candidateMap.has(label)) {
        candidateMap.set(label, entry);
      } else {
        const existing = candidateMap.get(label);
        // Prefer native audio if available, else prefer higher filesize
        if (!entry.requiresMerge && existing.requiresMerge) {
          candidateMap.set(label, entry);
        } else if (parseInt(entry.contentLength) > parseInt(existing.contentLength)) {
          candidateMap.set(label, entry);
        }
      }
    }

    // Sort descending by height (1080p first, then 720p, 480p, etc.)
    const videoFormats = Array.from(candidateMap.values()).sort((a, b) => b.height - a.height);
    const bestVideoFormat = videoFormats[0] || {
      itag: "hd",
      qualityLabel: "1080p Full HD",
      height: 1080,
      container: "mp4",
      url: mediaUrl,
      contentLength: String(Math.round(durationSeconds * 4500000 / 8)),
      requiresMerge: false,
      isDirectCdn: true,
    };

    const audioSize = bestAudioFormat?.filesize || bestAudioFormat?.filesize_approx || (durationSeconds * 320000 / 8);

    return NextResponse.json({
      platform,
      title,
      thumbnail,
      uploader,
      duration,
      durationSeconds,
      videoUrl: mediaUrl,
      videoFormats,
      bestVideo: bestVideoFormat,
      bestAudio: {
        url: bestAudioFormat?.url || bestVideoFormat.url,
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
