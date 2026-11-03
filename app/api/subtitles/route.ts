import { NextRequest, NextResponse } from "next/server";
import { resolveYtDlpBinary } from "@/lib/binResolver";
import { ensureNetscapeCookies } from "@/lib/cookieHelper";
import cp from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const lang = searchParams.get("lang") || "en";
  const format = searchParams.get("format") || "srt"; // srt | vtt | txt
  const title = searchParams.get("title") || "subtitles";

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const binPath = resolveYtDlpBinary();
  const tempDir = os.tmpdir();
  const filePrefix = `sub_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const outTemplate = path.join(tempDir, `${filePrefix}.%(ext)s`);

  return new Promise<NextResponse>((resolve) => {
    // yt-dlp --skip-download --write-sub --write-auto-sub --sub-lang en --convert-subs srt -o outTemplate url
    const cookiesPath = ensureNetscapeCookies();
    const cookieArgs = cookiesPath ? ["--cookies", cookiesPath] : [];

    const args = [
      url,
      "--skip-download",
      "--write-sub",
      "--write-auto-sub",
      "--sub-lang",
      lang,
      "--convert-subs",
      format === "txt" ? "srt" : format,
      "-o",
      outTemplate,
      "--no-warnings",
      "--js-runtimes",
      "node",
      ...cookieArgs,
    ];

    cp.execFile(binPath, args, { timeout: 30000 }, (error, stdout, stderr) => {
      // Find the generated subtitle file
      const ext = format === "txt" ? "srt" : format;
      const expectedFile = path.join(tempDir, `${filePrefix}.${lang}.${ext}`);

      // If exact match not found, find any file starting with filePrefix and ending with .srt/.vtt
      let finalFilePath = "";
      if (fs.existsSync(expectedFile)) {
        finalFilePath = expectedFile;
      } else {
        const files = fs.readdirSync(tempDir);
        const matched = files.find(
          (f) => f.startsWith(filePrefix) && (f.endsWith(".srt") || f.endsWith(".vtt"))
        );
        if (matched) {
          finalFilePath = path.join(tempDir, matched);
        }
      }

      if (!finalFilePath || !fs.existsSync(/*turbopackIgnore: true*/ finalFilePath)) {
        return resolve(
          NextResponse.json(
            { error: "No subtitles or lyrics found for this language." },
            { status: 404 }
          )
        );
      }

      let content = fs.readFileSync(/*turbopackIgnore: true*/ finalFilePath, "utf-8");

      // If text format requested, strip SRT timestamps and line numbers
      if (format === "txt") {
        content = content
          .replace(/\d+\r?\n\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d\r?\n/g, "")
          .replace(/<[^>]+>/g, "")
          .split(/[\r\n]+/)
          .map((line) => line.trim())
          .filter((line, i, arr) => line.length > 0 && line !== arr[i - 1])
          .join("\n");
      }

      // Clean up file
      try {
        fs.unlinkSync(finalFilePath);
      } catch {}

      const safeName = title.replace(/[^\w\s\-().]/g, "").replace(/\s+/g, "_");
      const outExt = format === "txt" ? "txt" : format;
      const mime = format === "txt" ? "text/plain" : "text/vtt";

      return resolve(
        new NextResponse(content, {
          status: 200,
          headers: {
            "Content-Type": `${mime}; charset=utf-8`,
            "Content-Disposition": `attachment; filename="${safeName}_lyrics.${outExt}"`,
          },
        })
      );
    });
  });
}
