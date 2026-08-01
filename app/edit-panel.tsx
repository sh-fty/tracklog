"use client";

import { createContext, useContext, useState } from "react";
import type { Entry } from "@/lib/store";

// The toggle belongs up beside the permalink, but the form has to render at
// the foot of the card at full width — inside the metadata column it gets
// indented past the artwork and splits the title off. Since those are two
// different places in the tree, the open state is shared through context
// rather than held by a single component.
//
// Client-side rather than <details> for the same reason plus one more: the
// panel has to close itself once a save goes through, and DOM open state on a
// <details> would survive revalidation and leave it hanging open.
//
// The server actions arrive as props and re-check the session cookie
// themselves, so nothing here is a security boundary; this is only chrome.
type EditCtx = { open: boolean; setOpen: (v: boolean) => void };

const Ctx = createContext<EditCtx>({ open: false, setOpen: () => {} });

export function EditProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function EditToggle() {
  const { open, setOpen } = useContext(Ctx);
  return (
    <button
      type="button"
      className="editbtn crs"
      aria-expanded={open}
      title="edit this entry"
      onClick={() => setOpen(!open)}
    >
      ✎
    </button>
  );
}

export function EditForm({
  entry,
  saveAction,
  deleteAction,
}: {
  entry: Entry;
  saveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const { open, setOpen } = useContext(Ctx);
  const [saving, setSaving] = useState(false);
  if (!open) return null;

  async function handleSave(formData: FormData) {
    setSaving(true);
    try {
      await saveAction(formData);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form action={handleSave} className="editform">
      <input type="hidden" name="id" value={entry.id} />

      {/* Artist first: it's the field that actually needs filling in, because
          Spotify's oEmbed never returns one. */}
      <label className="crs" htmlFor={`a-${entry.id}`}>
        artist
      </label>
      <input
        id={`a-${entry.id}`}
        name="artist"
        defaultValue={entry.artist ?? ""}
        placeholder="not provided by this platform"
      />

      <label className="crs" htmlFor={`n-${entry.id}`}>
        note
      </label>
      <textarea
        id={`n-${entry.id}`}
        name="note"
        defaultValue={entry.note ?? ""}
      />

      <label className="crs" htmlFor={`m-${entry.id}`}>
        dimension
      </label>
      <input id={`m-${entry.id}`} name="mood" defaultValue={entry.mood ?? ""} />

      {/* Last, because it's filled in automatically and usually right — it's
          here for the times a platform hands back a messy title. */}
      <label className="crs" htmlFor={`t-${entry.id}`}>
        title <span className="lblhint">(auto-filled)</span>
      </label>
      <input id={`t-${entry.id}`} name="title" defaultValue={entry.title} />

      <div className="editactions">
        <button type="submit" formAction={deleteAction} className="btn95 danger">
          delete
        </button>
        <button type="submit" className="btn95" disabled={saving}>
          {saving ? "saving…" : "save"}
        </button>
      </div>
    </form>
  );
}
