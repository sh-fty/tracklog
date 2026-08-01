import { NextResponse } from "next/server";
import { extractUrl, resolveMeta } from "@/lib/metadata";
import { secretMatches } from "@/lib/auth";
import { readJournal, writeJournal, type Entry } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const bearer = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!secretMatches(bearer)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    // empty or non-JSON body; handled below
  }

  const shared = String(body.url ?? body.text ?? "").trim();
  const url = extractUrl(shared);
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "no url found in what you shared" },
      { status: 400 },
    );
  }

  const clean = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s.length ? s : undefined;
  };

  const meta = await resolveMeta(url);

  const entry: Entry = {
    id: crypto.randomUUID(),
    url,
    addedAt: new Date().toISOString(),
    note: clean(body.note),
    mood: clean(body.mood),
    ...meta,
    // An artist typed into the Shortcut is a fallback, not an override: it
    // fills the gap only when the platform didn't supply one. Spotify's oEmbed
    // has no author field at all, so in practice this is the Spotify case,
    // while SoundCloud and YouTube keep their own answer — which means the
    // Shortcut can prompt unconditionally and needs no per-platform branch.
    artist: meta.artist ?? clean(body.artist),
  };

  // If the existing journal can't be read, abandon the write. Appending to an
  // assumed-empty journal would overwrite every entry already stored.
  let journal;
  try {
    journal = await readJournal();
  } catch {
    return NextResponse.json(
      { ok: false, error: "could not read the journal; nothing was saved" },
      { status: 503 },
    );
  }

  journal.entries.unshift(entry);
  await writeJournal(journal);

  return NextResponse.json({
    ok: true,
    logged: meta.artist ? `${meta.title} — ${meta.artist}` : meta.title,
  });
}
