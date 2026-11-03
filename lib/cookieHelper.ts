import fs from "fs";
import path from "path";

/**
 * Ensures cookies.txt is in valid Netscape format for yt-dlp.
 * If the file is in JSON format, converts it automatically.
 */
export function ensureNetscapeCookies(): string | null {
  const cookiesPath = path.resolve(process.cwd(), "cookies.txt");

  // If cookies.txt doesn't exist but YOUTUBE_COOKIES environment variable is provided (e.g. Render / Production)
  if (!fs.existsSync(cookiesPath) && process.env.YOUTUBE_COOKIES) {
    try {
      fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES.trim(), "utf8");
      console.log("[cookieHelper] Written cookies from YOUTUBE_COOKIES environment variable.");
    } catch (e) {
      console.warn("[cookieHelper] Failed to write YOUTUBE_COOKIES env var to file:", e);
    }
  }

  if (!fs.existsSync(cookiesPath)) return null;

  try {
    const content = fs.readFileSync(cookiesPath, "utf8").trim();
    if (content.startsWith("[") || content.startsWith("{")) {
      const parsed = JSON.parse(content);
      const cookies = Array.isArray(parsed) ? parsed : [parsed];

      let netscape =
        "# Netscape HTTP Cookie File\n# http://curl.haxx.se/rfc/cookie_spec.html\n# Auto-converted by YT_Download\n\n";

      for (const c of cookies) {
        const domain = c.domain || "";
        const flag = domain.startsWith(".") ? "TRUE" : "FALSE";
        const cookiePath = c.path || "/";
        const secure = c.secure ? "TRUE" : "FALSE";
        const expiry = Math.round(c.expirationDate || 2147483647);
        const name = c.name || "";
        const value = c.value || "";
        netscape += `${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiry}\t${name}\t${value}\n`;
      }

      fs.writeFileSync(cookiesPath, netscape, "utf8");
      console.log("[cookieHelper] Converted JSON cookies to Netscape format successfully.");
    }
    return cookiesPath;
  } catch (err) {
    console.warn("[cookieHelper] Failed to read/convert cookies:", err);
    return cookiesPath;
  }
}

