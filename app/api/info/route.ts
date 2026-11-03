import { NextRequest, NextResponse } from "next/server";
import { create } from "youtube-dl-exec";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import path from "path";
import fs from "fs";

/* ── YouTube URL validation ─────────────────── */
const YT_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

function extractVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

/* ── Duration formatter (seconds → "M:SS" / "H:MM:SS") */
function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Find absolute path to yt-dlp binary (cross-platform Linux/Docker + Windows)
const binPath = resolveYtDlpBinary();
const youtubedl = create(binPath);

/* ── POST /api/info ─────────────────────────── */
export async function POST(req: NextRequest) {
  let cookiesPath: string | null = null;
  try {
    const body = await req.json();
    const url: string | undefined = body?.url;

    if (!url || !YT_REGEX.test(url.trim())) {
      return NextResponse.json(
        { error: "Invalid YouTube URL. Please check the link and try again." },
        { status: 400 }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json({ error: "Could not extract video ID." }, { status: 400 });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    cookiesPath = ensureNetscapeCookies();
    const ytOptions: Record<string, any> = {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      jsRuntimes: process.platform === "linux" ? "deno" : "node",
    };

    if (cookiesPath) {
      ytOptions.cookies = cookiesPath;
    }

    // Extract using youtube-dl-exec with automatic client fallback
    let info: any = null;
    try {
      info = await youtubedl(videoUrl, ytOptions as any);
    } catch (primaryErr: any) {
      console.warn("[/api/info] Primary extraction failed, trying iOS/Android client fallback with player_skip=webpage...");
      try {
        info = await youtubedl(videoUrl, {
          ...ytOptions,
          extractorArgs: "youtube:player_client=ios,android,tv;player_skip=webpage",
        } as any);
      } catch (secErr: any) {
        console.warn("[/api/info] Second fallback failed, trying mweb client...");
        try {
          info = await youtubedl(videoUrl, {
            ...ytOptions,
            extractorArgs: "youtube:player_client=mweb,tv_embedded;player_skip=webpage",
          } as any);
        } catch {
          throw primaryErr;
        }
      }
    }

    if (!info || !info.formats || info.formats.length === 0) {
      return NextResponse.json({ error: "No formats available for this video." }, { status: 404 });
    }

    const withAudio: any[] = [];
    const withoutAudio: any[] = [];
    const audioOnly: any[] = [];

    info.formats.forEach((f: any) => {
      if (!f.url) return;

      const hasVideo = f.vcodec !== 'none';
      const hasAudio = f.acodec !== 'none';

      let qualityLabel = "";
      if (!hasVideo && hasAudio) {
        const isOpus = f.acodec?.includes("opus");
        const bitrate = f.abr ? Math.round(f.abr) : 0;
        
        if (isOpus) {
          let opusLabel = "160";
          if (f.format_id === "251") opusLabel = "153";
          else if (f.format_id === "250") opusLabel = "60";
          else if (f.format_id === "249") opusLabel = "50";
          else if (bitrate) opusLabel = String(bitrate);
          
          qualityLabel = `Audio OPUS ${opusLabel}`;
        } else {
          let m4aLabel = "128";
          if (f.format_id === "140") m4aLabel = "130";
          else if (f.format_id === "139") m4aLabel = "50";
          else if (bitrate) m4aLabel = String(bitrate);
          
          qualityLabel = `Audio M4A ${m4aLabel}`;
        }
      } else {
        if (f.height) {
          qualityLabel = f.fps && f.fps > 30 ? `${f.height}p${f.fps}` : `${f.height}p`;
        } else {
          qualityLabel = f.format_note || 'Video';
        }
      }

      const isWebM = f.ext === 'webm' || f.vcodec?.includes('vp9') || f.vcodec?.includes('av1') || f.acodec?.includes('opus');
      const container = isWebM ? 'webm' : f.ext === 'm4a' ? 'm4a' : 'mp4';
      const rawSize = f.filesize || f.filesize_approx || 0;

      const formatData = {
        itag: f.format_id,
        quality: f.format_id,
        qualityLabel: qualityLabel,
        container: container,
        vcodec: f.vcodec,
        url: f.url,
        hasAudio,
        hasVideo,
        contentLength: rawSize.toString(),
        mimeType: `${hasVideo ? 'video' : 'audio'}/${container}`,
      };

      const pushOrUpdate = (list: any[]) => {
        const existingIdx = list.findIndex(x => x.qualityLabel === qualityLabel && x.container === formatData.container);
        if (existingIdx === -1) {
          list.push(formatData);
        } else {
          const currentSize = parseInt(list[existingIdx].contentLength || "0", 10);
          const newSize = parseInt(formatData.contentLength || "0", 10);
          // Prefer format with valid filesize and non-m3u8 url
          if (newSize > currentSize || (currentSize === 0 && !formatData.url.includes("manifest"))) {
            list[existingIdx] = formatData;
          }
        }
      };

      if (hasVideo && hasAudio) {
        pushOrUpdate(withAudio);
      } else if (hasVideo && !hasAudio) {
        pushOrUpdate(withoutAudio);
      } else if (!hasVideo && hasAudio) {
        pushOrUpdate(audioOnly);
      }
    });

    // Find best audio for merging (prefer m4a with highest bitrate/contentLength)
    const m4aAudio = audioOnly.filter(f => f.container === 'm4a').sort((a, b) => 
      parseInt(b.contentLength || "0", 10) - parseInt(a.contentLength || "0", 10)
    );
    const bestAudio = m4aAudio[0] || audioOnly[0];

    // Auto-promote ALL video resolutions from withoutAudio to withAudio (8K, 4K, 1440p, 1080p, 720p, etc.)
    // Group withoutAudio by distinct qualityLabel, preferring MP4 and largest size
    const candidatesByLabel = new Map<string, any>();
    const sortedCandidates = [...withoutAudio].sort((a, b) => {
      if (a.container === 'mp4' && b.container !== 'mp4') return -1;
      if (b.container === 'mp4' && a.container !== 'mp4') return 1;
      return parseInt(b.contentLength || "0", 10) - parseInt(a.contentLength || "0", 10);
    });

    for (const vf of sortedCandidates) {
      if (!candidatesByLabel.has(vf.qualityLabel)) {
        candidatesByLabel.set(vf.qualityLabel, vf);
      }
    }

    candidatesByLabel.forEach((videoFormat, label) => {
      // Check if withAudio already has a native combined stream with audio for this label
      const alreadyHas = withAudio.some(f => f.qualityLabel === label && !f.requiresMerge);
      if (!alreadyHas && bestAudio) {
        const vSize = parseInt(videoFormat.contentLength || "0", 10);
        const aSize = parseInt(bestAudio.contentLength || "0", 10);
        
        withAudio.push({
          itag: videoFormat.itag,
          quality: `${videoFormat.quality}+${bestAudio.quality}`,
          qualityLabel: videoFormat.qualityLabel,
          container: 'mp4',
          vcodec: videoFormat.vcodec,
          url: videoFormat.url,
          hasAudio: true,
          hasVideo: true,
          contentLength: (vSize + aSize).toString(),
          requiresMerge: true,
        });
      }
    });

    // Score quality accurately: resolution * 1000 + fps (so 4320p60 > 2160p60 > 1440p60 > 1080p60 > 1080p > 720p)
    const parseQualityScore = (q: string) => {
      const resMatch = q.match(/(\d+)p/i) || q.match(/^(\d+)/);
      const res = resMatch ? parseInt(resMatch[1], 10) : 0;
      const fpsMatch = q.match(/p(\d+)/i);
      const fps = fpsMatch ? parseInt(fpsMatch[1], 10) : 30;
      return res * 1000 + fps;
    };
    
    withAudio.sort((a, b) => parseQualityScore(b.qualityLabel) - parseQualityScore(a.qualityLabel));
    
    withoutAudio.sort((a, b) => {
      if (a.container !== b.container) {
        return a.container.localeCompare(b.container); // Groups mp4 and webm
      }
      return parseQualityScore(b.qualityLabel) - parseQualityScore(a.qualityLabel);
    });
    
    audioOnly.sort((a, b) => {
      if (a.container !== b.container) {
        return a.container.localeCompare(b.container);
      }
      return parseInt(b.contentLength || "0", 10) - parseInt(a.contentLength || "0", 10);
    });

    const thumbnail = info.thumbnail || "";

    return NextResponse.json({
      title: info.title || "Video",
      thumbnail,
      duration: formatDuration(info.duration || 0),
      author: info.uploader || "Unknown",
      videoUrl: videoUrl,
      formats: {
        withAudio,
        withoutAudio,
        audioOnly,
      }
    });
  } catch (err: any) {
    console.error("[/api/info] Error:", err);
    const errMsg = err?.stderr || err?.message || String(err);
    
    if (errMsg.includes("Sign in to confirm you") || errMsg.includes("bot")) {
      return NextResponse.json(
        { 
          error: "YouTube anti-bot verification triggered for this video. Wait 1-2 minutes or try another video.",
          details: errMsg,
          cookiesLoaded: !!cookiesPath,
        },
        { status: 429 }
      );
    }

    if (errMsg.includes("Video unavailable") || errMsg.includes("Private video")) {
      return NextResponse.json(
        { error: "This video is unavailable or private on YouTube." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract video info. Please verify the URL or try again in a moment." },
      { status: 500 }
    );
  }
}
