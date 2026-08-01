import type { MetadataRoute } from "next";

// Makes "Add to Home Screen" open without browser chrome. That also removes
// the reload button, so the nav row carries its own refresh control — see
// app/refresh-button.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g by ilygoose",
    short_name: "trackl0g",
    description:
      process.env.NEXT_PUBLIC_SITE_TAGLINE ||
      "songs that alter my brain chemistry",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the window body and title bar, so the shell doesn't flash a
    // light background while loading.
    background_color: "#2e3440",
    theme_color: "#58627a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
