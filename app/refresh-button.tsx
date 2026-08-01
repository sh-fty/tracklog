"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Installed to the home screen there is no address bar and so no reload
// button, and pull-to-refresh isn't guaranteed in a standalone window. This is
// the dependable way to fetch the latest.
//
// router.refresh() re-runs the server render rather than reloading the
// document, so the page doesn't blank out. Note the journal blob is served
// with a 60s CDN floor, so a track shared moments ago may still need another
// go — that lag is the store's, not this button's.
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="navbtn crs"
      aria-label="refresh"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "↻ …" : "↻ refresh"}
    </button>
  );
}
