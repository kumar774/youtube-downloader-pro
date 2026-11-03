import path from "path";
import fs from "fs";

export function resolveYtDlpBinary(): string {
  // If running on Linux/Docker container (Render, Railway, VPS)
  if (process.platform === "linux") {
    const linuxPaths = [
      "/usr/local/bin/yt-dlp",
      "/usr/bin/yt-dlp",
      "/bin/yt-dlp",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // Windows or local npm package path
  const extBinary = process.platform === "win32" ? ".exe" : "";
  const localPkgBin = path.resolve(
    process.cwd(),
    `node_modules/youtube-dl-exec/bin/yt-dlp${extBinary}`
  );
  if (fs.existsSync(localPkgBin)) return localPkgBin;

  // Standalone bin folder fallback
  const standaloneBin = path.resolve(
    process.cwd(),
    `bin/yt-dlp${extBinary}`
  );
  if (fs.existsSync(standaloneBin)) return standaloneBin;

  return "yt-dlp";
}

export function resolveFfmpegBinary(): string | undefined {
  // If running on Linux/Docker container
  if (process.platform === "linux") {
    const linuxPaths = [
      "/usr/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  // Windows or ffmpeg-static path
  const ffmpegExt = process.platform === "win32" ? ".exe" : "";
  const resolvedFfmpegPath = path.resolve(
    process.cwd(),
    "node_modules/ffmpeg-static",
    `ffmpeg${ffmpegExt}`
  );
  if (fs.existsSync(resolvedFfmpegPath)) return resolvedFfmpegPath;

  // System PATH fallback
  return undefined;
}

