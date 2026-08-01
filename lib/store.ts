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

// `rev` is set on every write. It is what makes it safe to prefer an
// in-memory copy over what the CDN hands back: we can tell which of the two is
// actually newer instead of guessing. Entries written before this existed have
// no rev, which reads as 0 and always loses.
export type Journal = { entries: Entry[]; rev?: number };

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

// What this instance last wrote.
//
// The store gives no read-after-write consistency: a read can return content
// from before the last write — observed at `age: 91` against a `max-age=60`,
// so even the stated TTL is not a bound. Every mutation here is
// read-modify-write over the whole file, so two edits inside that window lose
// data; the second reads a pre-write copy and puts it back.
//
// An earlier version of this preferred the in-memory copy unconditionally for
// 90s, which was worse: if another instance had written more recently, this
// one served an older journal, so entries appeared to have vanished and a
// write built on it would have deleted them for real. Comparing `rev` fixes
// that — the in-memory copy is used only when it is provably newer than what
// came back, and a newer write from anywhere else always wins.
let lastWrite: Journal | null = null;

// Copied on the way in and out so callers mutating the journal — which every
// mutating action does — can't reach into this cache.
function clone(journal: Journal): Journal {
  return { entries: journal.entries.map((e) => ({ ...e })), rev: journal.rev };
}

// Throws when the journal cannot be read or parsed, and that matters: this is
// a read-modify-write store, so any caller that treats a failed read as "the
// journal is empty" and then writes would permanently destroy every existing
// entry. Display callers catch this and show a warning; mutating callers must
// let it propagate so the write is abandoned instead.
export async function readJournal(): Promise<Journal> {
  const text = await readBlobText(TRACKS_PATH);
  const parsed: Journal =
    text === null ? { entries: [] } : (JSON.parse(text) as Journal);
  if (!Array.isArray(parsed?.entries)) {
    throw new Error("journal blob is not in the expected shape");
  }
  if (lastWrite && (lastWrite.rev ?? 0) > (parsed.rev ?? 0)) {
    return clone(lastWrite);
  }
  return clone(parsed);
}

export async function writeJournal(journal: Journal): Promise<void> {
  journal.rev = Date.now();
  lastWrite = clone(journal);
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
