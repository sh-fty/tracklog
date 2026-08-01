"use client";

import { useState } from "react";

// A plain <details> was the first attempt, but the browser loads an iframe
// inside a closed <details> anyway — verified in-page: the collapsed player
// reported as cross-origin loaded. So the iframe is mounted on demand here
// instead. Nothing is requested from Spotify or SoundCloud, and no visitor is
// exposed to them, until someone actually asks to listen.
//
// Renders as a fragment so the button can sit inline beside the "from
// <provider>" link in the card's button row, while the player itself takes a
// full-width line of its own below it (see .embed in globals.css).
//
// This needs JavaScript. Without it there's no inline player, but the
// "from <provider>" link beside it is a plain anchor and still works.
export function Player({
  src,
  height,
  title,
}: {
  src: string;
  height: number;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="provbtn crs"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ♪ listen {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="embed">
          <iframe
            src={src}
            title={title}
            height={height}
            allow="encrypted-media; clipboard-write; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      )}
    </>
  );
}
