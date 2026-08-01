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

// Local development and production share one Blob store, because they share
// one BLOB_READ_WRITE_TOKEN. Without separate keys, anything written while
// testing locally lands in the real journal — and since writes are
// read-modify-write on a single file, that means real logged tracks can be
// overwritten by a throwaway test entry. Dev therefore gets its own keys and
// can never touch the live data.
const DEV = process.env.NODE_ENV !== "production";

const TRACKS_PATH = DEV ? "tracklog/tracks.dev.json" : "tracklog/tracks.json";
const HITS_PATH = DEV ? "tracklog/hits.dev.txt" : "tracklog/hits.txt";

// Public blob URLs sit behind Vercel's CDN, and the cache key ignores the
// query string — a `?v=` buster does nothing, so a read could return content
// from before the last write while list() metadata already showed the new
// size. Freshness therefore has to come from the write side, via
// cacheControlMaxAge below. The no-store fetch keeps the runtime's own fetch
// cache out of it as well.
// Returns null only when the blob genuinely does not exist yet (a brand new
// store). Anything else — a failed fetch, a bad status — throws, so callers
// can tell "there is nothing here" apart from "I could not find out".
// list() is a billed API call, and the naive version ran one on every render
// of every page. Because blobs here are written with addRandomSuffix:false to
// a fixed pathname, a blob's URL never changes, so it only has to be resolved
// once per instance and can be remembered — and writes can seed it for free.
const urlCache = new Map<string, string>();

function rememberUrl(pathname: string, url: string) {
  urlCache.set(pathname, url);
}

async function blobUrl(prefix: string): Promise<string | null> {
  const known = urlCache.get(prefix);
  if (known) return known;
  const { blobs } = await list({ prefix, limit: 1 });
  if (!blobs.length) return null;
  rememberUrl(prefix, blobs[0].url);
  return blobs[0].url;
}

async function readBlobText(prefix: string): Promise<string | null> {
  const url = await blobUrl(prefix);
  if (url === null) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`blob read failed for ${prefix}: HTTP ${res.status}`);
  }
  return res.text();
}

// What this instance last wrote, and when.
//
// Reads can be up to 60s stale (Vercel's cache floor), and every mutation here
// is read-modify-write over the whole file. Two edits inside that window
// therefore lose data: the second one reads a copy from before the first one's
// write and puts it back, silently reverting it. Observed directly — deleting
// one entry reinstated it and dropped a different, untouched one.
//
// Serving the journal we just wrote closes that window. It only covers
// mutations handled by the same instance, which for a single-author site is
// the ordinary case, but it is a mitigation rather than a guarantee: a write
// from another instance inside the same minute can still be missed.
let lastWrite: { journal: Journal; at: number } | null = null;
const WRITE_TRUST_MS = 90_000;

// Copied on the way in and out so callers mutating the journal — which every
// mutating action does — can't reach into this cache.
function clone(journal: Journal): Journal {
  return { entries: journal.entries.map((e) => ({ ...e })) };
}

// Throws when the journal cannot be read or parsed, and that matters: this is
// a read-modify-write store, so any caller that treats a failed read as "the
// journal is empty" and then writes would permanently destroy every existing
// entry. Display callers catch this and show a warning; mutating callers must
// let it propagate so the write is abandoned instead.
export async function readJournal(): Promise<Journal> {
  if (lastWrite && Date.now() - lastWrite.at < WRITE_TRUST_MS) {
    return clone(lastWrite.journal);
  }
  const text = await readBlobText(TRACKS_PATH);
  if (text === null) return { entries: [] };
  const parsed = JSON.parse(text) as Journal;
  if (!Array.isArray(parsed?.entries)) {
    throw new Error("journal blob is not in the expected shape");
  }
  return { entries: parsed.entries };
}

export async function writeJournal(journal: Journal): Promise<void> {
  lastWrite = { journal: clone(journal), at: Date.now() };
  const res = await put(TRACKS_PATH, JSON.stringify(journal, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    // Blobs default to `max-age=2592000` — thirty days — so without this an
    // edit or a newly shared track appears to vanish until the edge entry
    // expires. Vercel clamps this to a 60s floor (asking for 0 yields
    // `max-age=60`), so a write can still take up to a minute to show up.
    // That is the best the store offers; a query-string buster does not help,
    // because the CDN cache key ignores the query string.
    cacheControlMaxAge: 0,
  });
  rememberUrl(TRACKS_PATH, res.url);
}

// The hit counter used to cost a read *and a write* on every single page view,
// which made routine traffic the most expensive thing the site did — writes
// are the scarcest operation on the free tier, and this is what got the store
// suspended. The count is now held in memory and flushed at most once every
// five minutes.
//
// The trade is that the counter is approximate: buffered hits are lost when an
// instance recycles, and separate instances each flush their own tally. For a
// vanity counter that is a fine price for turning per-visitor writes into a
// handful per hour. It was never exact under concurrency anyway.
let hits: number | null = null;
let lastHitFlush = 0;
const HIT_FLUSH_MS = 5 * 60 * 1000;

export async function bumpHits(): Promise<number> {
  try {
    if (hits === null) {
      hits = parseInt(((await readBlobText(HITS_PATH)) ?? "").trim(), 10) || 0;
    }
    hits += 1;

    if (Date.now() - lastHitFlush < HIT_FLUSH_MS) return hits;
    lastHitFlush = Date.now();

    const res = await put(HITS_PATH, String(hits), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
      cacheControlMaxAge: 0,
    });
    rememberUrl(HITS_PATH, res.url);
    return hits;
  } catch {
    return hits ?? 1337;
  }
}
