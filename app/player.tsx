"use client";

import { createContext, useContext, useState } from "react";

// A plain <details> was the first attempt, but the browser loads an iframe
// inside a closed <details> anyway — verified in-page: the collapsed player
// reported as cross-origin loaded. So the iframe is mounted on demand here
// instead. Nothing is requested from Spotify or SoundCloud, and no visitor is
// exposed to them, until someone actually asks to listen.
//
// Toggle and iframe live in different parts of the card — the toggle is a tiny
// control on the artist line, while the player needs the card's full width, not
// the narrow metadata column — so the open state is shared through context.
//
// This needs JavaScript. Without it there's no inline player, but the
// "open <provider>" link beside it is a plain anchor and still works.
type PlayerCtx = { open: boolean; setOpen: (v: boolean) => void };

const Ctx = createContext<PlayerCtx>({ open: false, setOpen: () => {} });

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Ctx.Provider value={{ open, setOpen }}>{children}</Ctx.Provider>;
}

export function PlayerToggle() {
  const { open, setOpen } = useContext(Ctx);
  return (
    <button
      type="button"
      className="minibtn crs"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      ♪ listen {open ? "▴" : "▾"}
    </button>
  );
}

export function PlayerEmbed({
  src,
  height,
  title,
}: {
  src: string;
  height: number;
  title: string;
}) {
  const { open } = useContext(Ctx);
  if (!open) return null;
  return (
    <div className="embed">
      <iframe
        src={src}
        title={title}
        height={height}
        allow="encrypted-media; clipboard-write; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
