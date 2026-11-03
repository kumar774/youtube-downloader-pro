import { NextRequest, NextResponse } from "next/server";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import cp from "child_process";
import fs from "fs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url") || "https://www.youtube.com/watch?v=PbC3J_PK3oU";
  const clientArg = searchParams.get("client") || "mweb,tv,web_safari";
  const useCookies = searchParams.get("nocookies") !== "1";
  const potMode = searchParams.get("pot") || "cli";

  const binPath = resolveYtDlpBinary();
  const cookiesPath = useCookies ? ensureNetscapeCookies() : null;
  let cookieContent = "";
  let cookieSize = 0;

  if (cookiesPath && fs.existsSync(cookiesPath)) {
    cookieSize = fs.statSync(cookiesPath).size;
    cookieContent = fs.readFileSync(cookiesPath, "utf8").substring(0, 300);
  }

  let potServerStatus = "unknown";
  try {
    const potRes = await fetch("http://127.0.0.1:4416/ping", { signal: AbortSignal.timeout(1000) });
    potServerStatus = `HTTP ${potRes.status} (${await potRes.text()})`;
  } catch (e: any) {
    potServerStatus = `unreachable: ${e.message}`;
  }

  let bgutilLog = "";
  try {
    if (fs.existsSync('/tmp/bgutil.log')) {
      bgutilLog = fs.readFileSync('/tmp/bgutil.log', 'utf8').substring(0, 1000);
    }
  } catch {}

  return new Promise<NextResponse>((resolve) => {
    const args = [
      targetUrl,
      "--dump-json",
      "--verbose",
      "--no-check-certificates",
      "--plugin-dirs",
      "/etc/yt-dlp/plugins/bgutil",
      "--js-runtimes",
      process.platform === "linux" ? "deno" : "node",
      "--extractor-args",
      `youtube:player_client=${clientArg};player_skip=webpage`,
    ];

    if (potMode === "cli") {
      args.push("--extractor-args", "youtubepot-bgutilcli:cli_path=/usr/local/bin/bgutil-pot");
    } else {
      args.push("--extractor-args", "youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416");
    }

    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    }

    cp.execFile(binPath, args, { timeout: 25000 }, (error, stdout, stderr) => {
      resolve(
        NextResponse.json({
          platform: process.platform,
          binPath,
          targetUrl,
          clientArg,
          potServerStatus,
          bgutilLog,
          cookiesUsed: !!cookiesPath,
          exitCode: error?.code,
          stderr: stderr || error?.message,
          stdoutLength: stdout?.length || 0,
          title: stdout ? (tryParse(stdout)?.title || null) : null,
          success: !error && stdout.length > 0,
        })
      );
    });
  });
}

function tryParse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
