import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g",
  description:
    process.env.NEXT_PUBLIC_SITE_TAGLINE ||
    "a public log of songs that altered my brain chemistry",
};

export const viewport: Viewport = {
  // Matches the top of the title bar so the browser chrome blends into the
  // page on mobile, where the layout runs edge to edge.
  themeColor: "#5f5f9c",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
