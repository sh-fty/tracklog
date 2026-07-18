import { list, put } from "@vercel/blob";

export type Entry = {
  id: string;
  url: string;
  provider: string;
  title: string;
  artist?: string;
  art?: string;
  embedHtml?: string;
  note?: string;
  mood?: string;
  addedAt: string;
};

export type Journal = { entries: Entry[] };

const TRACKS_PATH = "tracklog/tracks.json";
const HITS_PATH = "tracklog/hits.txt";

// Public blob URLs sit behind Vercel's CDN cache; a unique query string per
// read guarantees we always see the latest write.
async function readBlobText(prefix: string): Promise<string | null> {
  const { blobs } = await list({ prefix, limit: 1 });
  if (!blobs.length) return null;
  const res = await fetch(`${blobs[0].url}?v=${Date.now()}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.text();
}

export async function readJournal(): Promise<Journal> {
  const text = await readBlobText(TRACKS_PATH);
  if (!text) return { entries: [] };
  try {
    const parsed = JSON.parse(text) as Journal;
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return { entries: [] };
  }
}

export async function writeJournal(journal: Journal): Promise<void> {
  await put(TRACKS_PATH, JSON.stringify(journal, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// A real, persistent hit counter. Lives in its own blob so visitor traffic
// never races with track writes. If the store is unreachable it falls back
// to a suitably vintage number.
export async function bumpHits(): Promise<number> {
  try {
    const current =
      parseInt(((await readBlobText(HITS_PATH)) ?? "").trim(), 10) || 0;
    const next = current + 1;
    await put(HITS_PATH, String(next), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
    });
    return next;
  } catch {
    return 1337;
  }
}
