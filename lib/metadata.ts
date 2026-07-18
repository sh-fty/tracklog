const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Share sheets often hand over text like "Song by Artist https://..." rather
// than a bare URL, so we fish the first link out of whatever arrived.
export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return null;
  return match[0].replace(/[),.;!?]+$/, "");
}

function providerFor(host: string): string {
  if (host.includes("spotify")) return "spotify";
  if (host.includes("soundcloud")) return "soundcloud";
  if (host.includes("youtu")) return "youtube";
  if (host.includes("bandcamp")) return "bandcamp";
  if (host.includes("music.apple")) return "apple music";
  if (host.includes("tidal")) return "tidal";
  if (host.includes("mixcloud")) return "mixcloud";
  return host.replace(/^www\./, "");
}

// These three expose public oEmbed endpoints: title, artwork, and a
// ready-made embed player, no API keys required.
function oembedEndpoint(url: string, host: string): string | null {
  if (host.endsWith("spotify.com") || host === "spotify.link") {
    return `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  }
  if (host.endsWith("soundcloud.com")) {
    return `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  }
  if (host.endsWith("youtube.com") || host === "youtu.be") {
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function ogTag(html: string, prop: string): string | undefined {
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  );
  const hit = html.match(forward)?.[1] ?? html.match(reversed)?.[1];
  return hit ? decodeEntities(hit).trim() : undefined;
}

// SoundCloud titles arrive as "Song by Artist", Bandcamp as "Song, by Artist",
// Apple Music as "Song by Artist on Apple Music". Split when we can.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitTitle(
  raw: string,
  author?: string,
): { title: string; artist?: string } {
  let title = raw.replace(/[\u200e\u200f]/g, "").trim();
  let artist = author?.trim() || undefined;
  if (artist) {
    const suffix = new RegExp(`,?\\s+by\\s+${escapeRegex(artist)}\\s*$`, "i");
    title = title.replace(suffix, "").trim() || title;
  } else {
    const m = title.match(/^(.+?),?\s+by\s+(.+?)(?:\s+on\s+\S.*)?$/i);
    if (m) {
      title = m[1].trim();
      artist = m[2].trim();
    }
  }
  return { title, artist };
}

export type TrackMeta = {
  provider: string;
  title: string;
  artist?: string;
  art?: string;
  embedHtml?: string;
};

export async function resolveMeta(url: string): Promise<TrackMeta> {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    // fall through with empty host
  }
  const provider = providerFor(host);

  const endpoint = host ? oembedEndpoint(url, host) : null;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        headers: { "user-agent": UA },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
          html?: string;
        };
        const { title, artist } = splitTitle(
          String(data.title ?? ""),
          data.author_name,
        );
        if (title) {
          return {
            provider,
            title,
            artist,
            art: data.thumbnail_url,
            embedHtml: typeof data.html === "string" ? data.html : undefined,
          };
        }
      }
    } catch {
      // fall through to the Open Graph scrape
    }
  }

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const html = await res.text();
    const rawTitle =
      ogTag(html, "og:title") ??
      decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
    const { title, artist } = splitTitle(rawTitle);
    return { provider, title: title || url, artist, art: ogTag(html, "og:image") };
  } catch {
    return { provider, title: url };
  }
}
