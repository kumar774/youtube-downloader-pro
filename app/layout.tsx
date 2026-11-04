import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "SnapSave — Ultra-Fast Media Downloader",
  description:
    "Download YouTube, Instagram, and Facebook videos at maximum speed. Blazing-fast downloads in high quality MP4, WebM, and MP3 formats.",
  keywords: ["youtube downloader", "instagram downloader", "facebook downloader", "video downloader", "mp4", "mp3", "hd download"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased overflow-x-hidden`}>
      <body className="relative min-h-full flex flex-col w-full max-w-full overflow-x-hidden">
        {/* Ambient background orbs contained safely */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-100px] left-[-100px]" />
          <div className="bg-orb w-[400px] h-[400px] bg-purple-600 bottom-[20%] right-[-80px]" />
          <div className="bg-orb w-[300px] h-[300px] bg-emerald-600 top-[60%] left-[30%]" />
        </div>

        <div className="relative z-10 flex min-h-full flex-col w-full max-w-full">
          {children}
        </div>
      </body>
    </html>
  );
}
