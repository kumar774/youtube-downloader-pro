import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SnapSave — Ultra-Fast YouTube Downloader",
  description:
    "Download YouTube videos at maximum speed. Blazing-fast downloads in high quality MP4, WebM, and MP3 formats.",
  keywords: ["youtube downloader", "video downloader", "mp4", "mp3", "hd download"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="relative min-h-full flex flex-col overflow-x-hidden">
        {/* Ambient background orbs */}
        <div className="bg-orb w-[500px] h-[500px] bg-indigo-600 top-[-100px] left-[-100px]" />
        <div className="bg-orb w-[400px] h-[400px] bg-purple-600 bottom-[20%] right-[-80px]" />
        <div className="bg-orb w-[300px] h-[300px] bg-emerald-600 top-[60%] left-[30%]" />

        {children}
      </body>
    </html>
  );
}
