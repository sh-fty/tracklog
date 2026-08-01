"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, isAdmin, secretMatches, sessionToken } from "@/lib/auth";
import { extractUrl, resolveMeta } from "@/lib/metadata";
import { readJournal, writeJournal, type Entry } from "@/lib/store";

export async function login(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!secretMatches(key)) redirect("/?bad=1");
  const token = sessionToken();
  if (!token) redirect("/?bad=1");
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/");
}

export type SaveResult =
  | { ok: true; entry: Entry }
  | { ok: false; error: string };

export type DeleteResult = { ok: true } | { ok: false; error: string };

// Both mutating actions re-check the cookie server-side. Hiding the controls
// from logged-out visitors is presentation only; this is the actual gate, and
// it runs even if someone posts to the action directly.
//
// They return the result rather than relying on revalidatePath alone. The
// journal blob is served with a 60s CDN floor, so re-rendering the page after
// a write can still read stale content — the caller updates its own state
// from what comes back here instead of re-reading.
export async function saveEntry(formData: FormData): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, error: "not signed in" };

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "title can't be empty" };

  let journal;
  try {
    // A failed read must never become a write — see readJournal in lib/store.
    journal = await readJournal();
  } catch {
    return { ok: false, error: "couldn't read the journal; nothing saved" };
  }

  const entry = journal.entries.find((e) => e.id === id);
  if (!entry) {
    return {
      ok: false,
      error: "this track was removed elsewhere — reload to see the current list",
    };
  }

  // Every field here clears when blank, except title, which is required and
  // rejected above rather than silently falling back to the old value.
  const optional = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v.length ? v : undefined;
  };
  entry.title = title;
  entry.artist = optional("artist");
  entry.note = optional("note");
  entry.mood = optional("mood");

  // Re-linking. Shared links that resolve to nothing — a Shazam page, say —
  // can be logged with a note now and pointed at a real record later. When the
  // link changes the title, artist and artwork are re-fetched from the new
  // source and replace whatever was in the form, since adopting the new
  // source's metadata is the whole point. The note and dimension are kept.
  const raw = String(formData.get("url") ?? "").trim();
  const url = raw ? extractUrl(raw) : null;
  if (raw && !url) return { ok: false, error: "that doesn't look like a link" };

  if (url && url !== entry.url) {
    const meta = await resolveMeta(url);
    entry.url = url;
    entry.provider = meta.provider;
    // A resolution that failed hands back the URL as the title; don't let that
    // overwrite a title the entry already has.
    if (meta.title && meta.title !== url) entry.title = meta.title;
    if (meta.artist) entry.artist = meta.artist;
    if (meta.art) entry.art = meta.art;
  }

  await writeJournal(journal);
  revalidatePath("/");
  return { ok: true, entry };
}

export async function deleteEntry(id: string): Promise<DeleteResult> {
  if (!(await isAdmin())) return { ok: false, error: "not signed in" };

  let journal;
  try {
    journal = await readJournal();
  } catch {
    return { ok: false, error: "couldn't read the journal; nothing deleted" };
  }

  const remaining = journal.entries.filter((e) => e.id !== id);

  // Deleting something already gone is a success, not an error. Reads lag
  // writes here, so a stale render can still show an entry that has been
  // removed; asking for it to go away again should just work.
  if (remaining.length === journal.entries.length) {
    revalidatePath("/");
    return { ok: true };
  }

  await writeJournal({ entries: remaining });
  revalidatePath("/");
  return { ok: true };
}
