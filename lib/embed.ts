import type { Entry } from "./store";

export type Embed = { src: string; height: number; title: string };

// Player URLs are rebuilt here from parsed pieces of the shared link rather
// than taken from the provider's oEmbed HTML. That keeps the page free of
// dangerouslySetInnerHTML: a provider can only ever cause an iframe pointed
// at one of the hosts below, never arbitrary markup in our document.
//
// Anything not matched returns null and the entry falls back to the plain
// "from <provider>" link, which is always rendered regardless.
export function embedFor(entry: Entry): Embed | null {
  let u: URL;
  try {
    u = new URL(entry.url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const title = `${entry.title} player`;

  // open.spotify.com/track/ID -> open.spotify.com/embed/track/ID
  if (host === "open.spotify.com") {
    const path = u.pathname.replace(/^\/embed/, "");
    if (!/^\/(track|album|playlist|episode|show)\/[A-Za-z0-9]+$/.test(path)) {
      return null;
    }
    return {
      src: `https://open.spotify.com/embed${path}`,
      height: path.startsWith("/track/") ? 152 : 352,
      title,
    };
  }

  // SoundCloud's widget takes the canonical track URL as a parameter.
  if (host === "soundcloud.com") {
    const canonical = `https://soundcloud.com${u.pathname}`;
    const q = new URLSearchParams({
      url: canonical,
      color: "#00f000",
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      show_user: "true",
      show_reposts: "false",
      visual: "false",
    });
    return { src: `https://w.soundcloud.com/player/?${q}`, height: 166, title };
  }

  if (host === "youtube.com" || host === "youtu.be") {
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1)
        : (u.searchParams.get("v") ?? "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return { src: `https://www.youtube.com/embed/${id}`, height: 200, title };
  }

  // Apple Music serves a preview player on a dedicated embed subdomain.
  if (host === "music.apple.com") {
    return {
      src: `https://embed.music.apple.com${u.pathname}${u.search}`,
      height: 175,
      title,
    };
  }

  return null;
}
