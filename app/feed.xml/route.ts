import { readJournal } from "@/lib/store";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  const journal = await readJournal().catch(() => ({ entries: [] }));
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const title = process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g";
  const tagline =
    process.env.NEXT_PUBLIC_SITE_TAGLINE ||
    "a public log of songs that altered my brain chemistry";

  const items = journal.entries
    .slice(0, 50)
    .map((e) => {
      const name = e.artist ? `${e.title} — ${e.artist}` : e.title;
      const desc = [e.note, e.mood ? `current mood: ${e.mood}` : ""]
        .filter(Boolean)
        .join(" · ");
      return `    <item>
      <title>${esc(name)}</title>
      <link>${esc(e.url)}</link>
      <guid isPermaLink="false">${esc(e.id)}</guid>
      <pubDate>${new Date(e.addedAt).toUTCString()}</pubDate>
      <description>${esc(desc)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(origin)}</link>
    <description>${esc(tagline)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
