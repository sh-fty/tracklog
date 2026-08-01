"use client";

import { useState } from "react";
import type { DeleteResult, SaveResult } from "./actions";
import type { Embed } from "@/lib/embed";
import type { Entry } from "@/lib/store";

// The whole card is one client component so an edit or a delete can be
// reflected immediately from what the action returns. Re-reading the journal
// would not work: the blob is served with a 60s CDN floor, so even a full page
// refresh can show pre-edit content for up to a minute.
//
// It also keeps the player, the edit panel and the row controls in one place;
// they were previously three components sharing state through two separate
// contexts, which is what made the editing UI behave inconsistently.
export function TrackCard({
  entry: initialEntry,
  index,
  authed,
  current,
  embed,
  saveAction,
  deleteAction,
}: {
  entry: Entry;
  index: number;
  authed: boolean;
  current: boolean;
  embed: Embed | null;
  saveAction: (formData: FormData) => Promise<SaveResult>;
  deleteAction: (id: string) => Promise<DeleteResult>;
}) {
  const [entry, setEntry] = useState(initialEntry);
  const [gone, setGone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (gone) return null;

  async function handleSave(formData: FormData) {
    setBusy(true);
    setError(null);
    try {
      const res = await saveAction(formData);
      if (res.ok) {
        setEntry(res.entry);
        setEditing(false);
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(false);
    }
  }

  // Return submits from any field, including the note. iOS otherwise inserts a
  // newline in the textarea rather than submitting, and its keyboard offers no
  // obvious way to commit the form. Shift+Return still gives a newline on a
  // hardware keyboard, so multi-line notes are still possible there.
  function submitOnEnter(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    const el = e.target as HTMLElement;
    if (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
    const form = e.currentTarget;
    e.preventDefault();
    // Deferred rather than called inline: requestSubmit() from inside React's
    // own keydown handling doesn't reach the form action, though the identical
    // call works once the event has finished dispatching.
    setTimeout(() => form.requestSubmit(), 0);
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await deleteAction(entry.id);
      if (res.ok) setGone(true);
      else {
        setError(res.error);
        setConfirming(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const line = [
    entry.mood ? `in ${entry.mood} dimension` : "",
    entry.note ?? "",
  ]
    .filter(Boolean)
    .join("  ···  ");
  const scrolls = line.length > 30;

  return (
    <article className="entry" id={entry.id}>
      <div className={current ? "card bvi current" : "card bvi"}>
        <div className="cardtop">
          {entry.art ? (
            <img
              className="art"
              src={entry.art}
              alt={`artwork for ${entry.title}`}
              width={84}
              height={84}
              loading="lazy"
            />
          ) : (
            <div className="art artfallback" aria-hidden="true">
              <span />
            </div>
          )}

          <div className="cardmeta">
            <div className="numline crs">
              <span className="tracknum">{String(index).padStart(2, "0")}.</span>
              <a
                className="minibtn crs"
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶ open {entry.provider}
              </a>
              {embed && (
                <button
                  type="button"
                  className="minibtn crs"
                  aria-expanded={playing}
                  onClick={() => setPlaying((v) => !v)}
                >
                  ♪ listen {playing ? "▴" : "▾"}
                </button>
              )}
              <a
                className="permalink"
                href={`#${entry.id}`}
                aria-label="permalink"
              >
                #
              </a>
              {authed && (
                <button
                  type="button"
                  className="editbtn crs"
                  aria-expanded={editing}
                  title="edit this entry"
                  onClick={() => {
                    setEditing((v) => !v);
                    setConfirming(false);
                    setError(null);
                  }}
                >
                  ✎
                </button>
              )}
            </div>

            <h2 className="tt">{entry.title}</h2>
            {entry.artist && <p className="ta">{entry.artist}</p>}

            {line && (
              <div className="trackline crs" title={line}>
                {scrolls ? (
                  <span
                    className="tlscroll"
                    style={{ animationDuration: `${Math.round(line.length * 0.34)}s` }}
                  >
                    {`${line}  ···  ${line}  ···  `}
                  </span>
                ) : (
                  <span>{line}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Full card width, rather than the narrow metadata column. Mounted
            only once open, so the provider is not contacted before then. */}
        {embed && playing && (
          <div className="embed">
            <iframe
              src={embed.src}
              title={embed.title}
              height={embed.height}
              allow="encrypted-media; clipboard-write; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )}

        {authed && editing && (
          <form
            action={handleSave}
            className="editform"
            onKeyDown={submitOnEnter}
          >
            <input type="hidden" name="id" value={entry.id} />

            <label className="crs" htmlFor={`t-${entry.id}`}>
              title <span className="lblhint">(required)</span>
            </label>
            <input
              id={`t-${entry.id}`}
              name="title"
              type="text"
              required
              autoCapitalize="none"
              enterKeyHint="done"
              defaultValue={entry.title}
            />

            <label className="crs" htmlFor={`a-${entry.id}`}>
              artist
            </label>
            <input
              id={`a-${entry.id}`}
              name="artist"
              type="text"
              autoCapitalize="none"
              enterKeyHint="done"
              defaultValue={entry.artist ?? ""}
              placeholder="blank — spotify doesn't supply one"
            />

            <label className="crs" htmlFor={`n-${entry.id}`}>
              note
            </label>
            <textarea
              id={`n-${entry.id}`}
              name="note"
              autoCapitalize="none"
              enterKeyHint="done"
              defaultValue={entry.note ?? ""}
            />

            <label className="crs" htmlFor={`m-${entry.id}`}>
              dimension
            </label>
            <input
              id={`m-${entry.id}`}
              name="mood"
              type="text"
              autoCapitalize="none"
              enterKeyHint="done"
              defaultValue={entry.mood ?? ""}
            />

            <p className="editnote crs">
              return saves · every field except title clears when left blank.
            </p>

            {error && <p className="editerr crs">{error}</p>}

            <div className="editactions">
              {confirming ? (
                <>
                  <span className="confirmq crs">delete for good?</span>
                  <button
                    type="button"
                    className="btn95"
                    disabled={busy}
                    onClick={() => setConfirming(false)}
                  >
                    cancel
                  </button>
                  <button
                    type="button"
                    className="btn95 danger"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    {busy ? "deleting…" : "yes, delete"}
                  </button>
                </>
              ) : (
                <>
                  {/* Deletes are immediate and there is no undo, so this asks
                      once before doing it. */}
                  <button
                    type="button"
                    className="btn95 danger"
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                  >
                    delete
                  </button>
                  <button type="submit" className="btn95" disabled={busy}>
                    {busy ? "saving…" : "save"}
                  </button>
                </>
              )}
            </div>
          </form>
        )}
      </div>
    </article>
  );
}
