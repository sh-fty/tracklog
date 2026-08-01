import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Lets iOS open it from the home screen without browser chrome.
  appleWebApp: { capable: true, title: "trackl0g" },
  title: process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g",
  description:
    process.env.NEXT_PUBLIC_SITE_TAGLINE ||
    "songs that alter my brain chemistry",
};

export const viewport: Viewport = {
  // Matches the top of the title bar so the browser chrome blends into the
  // page on mobile, where the layout runs edge to edge.
  themeColor: "#4d5488",
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
