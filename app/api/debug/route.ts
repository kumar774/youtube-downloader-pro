import { NextRequest, NextResponse } from "next/server";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import cp from "child_process";
import fs from "fs";

export async function GET(req: NextRequest) {
  const binPath = resolveYtDlpBinary();
  const cookiesPath = ensureNetscapeCookies();
  let cookieContent = "";
  let cookieSize = 0;

  if (cookiesPath && fs.existsSync(cookiesPath)) {
    cookieSize = fs.statSync(cookiesPath).size;
    cookieContent = fs.readFileSync(cookiesPath, "utf8").substring(0, 300);
  }

  return new Promise<NextResponse>((resolve) => {
    const args = [
      "https://www.youtube.com/watch?v=PbC3J_PK3oU",
      "--dump-json",
      "--verbose",
      "--no-check-certificates",
      "--js-runtimes",
      "node",
    ];

    if (cookiesPath) {
      args.push("--cookies", cookiesPath);
    }

    cp.execFile(binPath, args, { timeout: 25000 }, (error, stdout, stderr) => {
      resolve(
        NextResponse.json({
          platform: process.platform,
          binPath,
          binExists: fs.existsSync(binPath),
          cookiesPath,
          cookieSize,
          cookieSnippet: cookieContent,
          envVarLength: process.env.YOUTUBE_COOKIES?.length || 0,
          exitCode: error?.code,
          stderr: stderr || error?.message,
          stdoutLength: stdout?.length || 0,
          success: !error && stdout.length > 0,
        })
      );
    });
  });
}
