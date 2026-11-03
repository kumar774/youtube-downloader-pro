import { NextRequest, NextResponse } from "next/server";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import cp from "child_process";
import fs from "fs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url") || "https://www.youtube.com/watch?v=PbC3J_PK3oU";
  const clientArg = searchParams.get("client") || "ios,android,tv";
  const useCookies = searchParams.get("nocookies") !== "1";

  const binPath = resolveYtDlpBinary();
  const cookiesPath = useCookies ? ensureNetscapeCookies() : null;
  let cookieContent = "";
  let cookieSize = 0;

  if (cookiesPath && fs.existsSync(cookiesPath)) {
    cookieSize = fs.statSync(cookiesPath).size;
    cookieContent = fs.readFileSync(cookiesPath, "utf8").substring(0, 300);
  }

  let bgutilDir: string[] = [];
  try {
    if (fs.existsSync('/opt/bgutil')) {
      bgutilDir = fs.readdirSync('/opt/bgutil');
    }
  } catch {}

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
      "--js-runtimes",
      process.platform === "linux" ? "deno" : "node",
      "--extractor-args",
      `youtube:player_client=${clientArg};player_skip=webpage`,
    ];

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
          bgutilDir,
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
