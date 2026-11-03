/**
 * Distributed Invidious / Piped video extractor
 * Used as an automatic fallback when cloud server IPs (Render / AWS) get 429 blocked by YouTube.
 * Queries healthy public Invidious instances to extract full video metadata and direct CDN formats.
 */

// Curated list of high-uptime, fast public Invidious instances
const STATIC_INSTANCES = [
  "https://yt.chocolatemoo53.com",
  "https://invidious.nerdvpn.de",
  "https://invidious.jing.rocks",
  "https://invidious.slipfox.xyz",
  "https://inv.vern.cc",
  "https://iv.ggtyler.dev",
  "https://invidious.projectsegfau.lt",
  "https://vid.priv.au",
];

let cachedHealthyInstances: string[] = [...STATIC_INSTANCES];
let lastInstanceFetch = 0;

/**
 * Fetch and update healthy instances dynamically if needed
 */
async function refreshHealthyInstances(): Promise<string[]> {
  const now = Date.now();
  // Refresh at most once every 30 minutes
  if (now - lastInstanceFetch < 30 * 60 * 1000 && cachedHealthyInstances.length > 0) {
    return cachedHealthyInstances;
  }

  try {
    const res = await fetch("https://api.invidious.io/instances.json?sort_by=health", {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      const healthy: string[] = [];
      for (const [_, meta] of data) {
        if (meta && meta.type === "https" && meta.api === true && meta.uri) {
          healthy.push(meta.uri.replace(/\/+$/, ""));
        }
      }
      if (healthy.length > 0) {
        cachedHealthyInstances = [...new Set([...healthy, ...STATIC_INSTANCES])];
        lastInstanceFetch = now;
      }
    }
  } catch (e) {
    // If dynamic discovery fails, use static list
    cachedHealthyInstances = STATIC_INSTANCES;
  }

  return cachedHealthyInstances;
}

/**
 * Query a single Invidious instance for video metadata and streaming formats
 */
async function queryInstance(baseUrl: string, videoId: string): Promise<any | null> {
  const url = `${baseUrl}/api/v1/videos/${videoId}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(4500),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json",
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  if (!data || (!data.formatStreams && !data.adaptiveFormats)) return null;

  return data;
}

/**
 * Main resolver function: queries instances in fast batches
 */
export async function resolveInvidiousVideo(videoId: string): Promise<any | null> {
  const instances = await refreshHealthyInstances();
  
  // Try top instances in fast parallel batches of 2-3
  const batchSize = 3;
  for (let i = 0; i < Math.min(instances.length, 9); i += batchSize) {
    const batch = instances.slice(i, i + batchSize);
    try {
      const results = await Promise.allSettled(
        batch.map((inst) => queryInstance(inst, videoId))
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          return mapInvidiousToYtDlp(r.value, videoId);
        }
      }
    } catch {
      // continue to next batch
    }
  }

  return null;
}

/**
 * Transforms Invidious JSON into standard yt-dlp info format expected by app/api/info
 */
function mapInvidiousToYtDlp(data: any, videoId: string): any {
  const rawFormats: any[] = [];

  // 1. Combined audio+video streams (formatStreams)
  if (Array.isArray(data.formatStreams)) {
    for (const f of data.formatStreams) {
      if (!f.url) continue;
      const resMatch = f.resolution?.match(/(\d+)x(\d+)/) || f.qualityLabel?.match(/(\d+)p/);
      const height = resMatch ? parseInt(resMatch[2] || resMatch[1], 10) : (f.quality === "hd720" ? 720 : 360);
      const isWebm = f.type?.includes("webm");

      rawFormats.push({
        format_id: String(f.itag || "18"),
        url: f.url,
        ext: isWebm ? "webm" : "mp4",
        vcodec: isWebm ? "vp9" : "avc1",
        acodec: isWebm ? "opus" : "mp4a",
        height: height,
        fps: f.fps || 30,
        filesize: f.size ? parseInt(f.size, 10) : (f.clen ? parseInt(f.clen, 10) : 0),
        format_note: f.qualityLabel || `${height}p`,
      });
    }
  }

  // 2. Adaptive separate streams (video-only and audio-only)
  if (Array.isArray(data.adaptiveFormats)) {
    for (const f of data.adaptiveFormats) {
      if (!f.url) continue;
      const isVideo = f.type?.startsWith("video");
      const isAudio = f.type?.startsWith("audio");
      const isWebm = f.type?.includes("webm");

      let height: number | null = null;
      if (isVideo) {
        const resMatch = f.resolution?.match(/(\d+)x(\d+)/) || f.qualityLabel?.match(/(\d+)p/);
        height = resMatch ? parseInt(resMatch[2] || resMatch[1], 10) : (parseInt(f.qualityLabel, 10) || 720);
      }

      const rawSize = f.size ? parseInt(f.size, 10) : (f.clen ? parseInt(f.clen, 10) : 0);
      const bitrate = f.bitrate ? Math.round(parseInt(f.bitrate, 10) / 1000) : 0;

      rawFormats.push({
        format_id: String(f.itag || (isVideo ? "137" : "140")),
        url: f.url,
        ext: isWebm ? "webm" : (isVideo ? "mp4" : "m4a"),
        vcodec: isVideo ? (isWebm ? "vp9" : "avc1") : "none",
        acodec: isAudio ? (isWebm ? "opus" : "mp4a") : "none",
        height: height,
        fps: f.fps || (isVideo ? 30 : null),
        abr: isAudio ? bitrate : null,
        filesize: rawSize,
        filesize_approx: rawSize,
        format_note: f.qualityLabel || (isAudio ? `${bitrate}k` : `${height}p`),
      });
    }
  }

  // Choose best thumbnail
  let bestThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  if (Array.isArray(data.videoThumbnails) && data.videoThumbnails.length > 0) {
    const maxRes = data.videoThumbnails.find((t: any) => t.quality === "maxresdefault" || t.quality === "high");
    bestThumb = maxRes?.url || data.videoThumbnails[0].url;
  }

  return {
    id: videoId,
    title: data.title || "YouTube Video",
    thumbnail: bestThumb,
    duration: data.lengthSeconds || 0,
    uploader: data.author || "YouTube Creator",
    formats: rawFormats,
  };
}
