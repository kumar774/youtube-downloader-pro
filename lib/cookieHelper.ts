import fs from "fs";
import path from "path";
import os from "os";

/**
 * Ensures cookies.txt is in valid Netscape format for yt-dlp.
 * Supports:
 * 1. Base64 or plain-text YOUTUBE_COOKIES environment variable (for Render/Cloud)
 * 2. Local cookies.txt (Netscape or JSON format, auto-converts)
 * Writes to os.tmpdir() for cross-platform/container write safety.
 */
export function ensureNetscapeCookies(): string | null {
  const tmpCookiesPath = path.join(os.tmpdir(), "yt_cookies.txt");
  const localCookiesPath = path.resolve(process.cwd(), "cookies.txt");

  let rawContent: string | null = null;

  // 1. Check YOUTUBE_COOKIES environment variable
  if (process.env.YOUTUBE_COOKIES) {
    let envVal = process.env.YOUTUBE_COOKIES.trim();
    // Try base64 decode if applicable
    try {
      const decoded = Buffer.from(envVal, "base64").toString("utf8");
      if (
        decoded.includes("youtube.com") ||
        decoded.startsWith("# Netscape") ||
        decoded.startsWith("[")
      ) {
        envVal = decoded;
      }
    } catch {
      // not base64, use raw
    }
    rawContent = envVal;
  } else if (fs.existsSync(localCookiesPath)) {
    try {
      rawContent = fs.readFileSync(localCookiesPath, "utf8").trim();
    } catch (e) {
      console.warn("[cookieHelper] Failed to read local cookies.txt:", e);
    }
  }

  if (!rawContent) return null;

  try {
    let netscapeContent = rawContent;

    // Auto-convert JSON cookies to Netscape format
    if (rawContent.startsWith("[") || rawContent.startsWith("{")) {
      const parsed = JSON.parse(rawContent);
      const cookies = Array.isArray(parsed) ? parsed : [parsed];

      netscapeContent =
        "# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# Auto-converted by YT_Download\n\n";

      for (const c of cookies) {
        const domain = c.domain || "";
        const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
        const cookiePath = c.path || "/";
        const secure = c.secure ? "TRUE" : "FALSE";
        const expiry = Math.round(c.expirationDate || 2147483647);
        const name = c.name || "";
        const value = c.value || "";
        netscapeContent += `${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiry}\t${name}\t${value}\n`;
      }
    }

    // Write to tmp path (guaranteed writable across Linux/Docker/Windows)
    fs.writeFileSync(tmpCookiesPath, netscapeContent, "utf8");

    // Also update local file if possible
    try {
      fs.writeFileSync(localCookiesPath, netscapeContent, "utf8");
    } catch {
      // ignore in read-only environments
    }

    return tmpCookiesPath;
  } catch (err) {
    console.warn("[cookieHelper] Failed to format cookies:", err);
    return fs.existsSync(tmpCookiesPath) ? tmpCookiesPath : null;
  }
}
