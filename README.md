# trackl0g

A single-page public music journal wearing the visual language of a late-90s
skinnable desktop media player: navy panels with hard bevels, gold-barred title
bars, silver buttons with dark ink, black LCD wells in phosphor green, amber
accents. Share a track from Spotify, SoundCloud, YouTube, Bandcamp or Apple
Music straight from your phone's share sheet, add a note and a dimension, and
it appears on your site seconds later — artwork, title, artist, an inline
player, a real hit counter, an RSS feed.

None of the *functional* chrome is reproduced — no equaliser, transport bar or
visualiser — because the page doesn't play anything itself and those controls
would misstate what it does. The look is all CSS gradients and borders; no
skin assets, no webfonts, nothing fetched off-origin.

No music-platform API keys. No OAuth. No database. One JSON file in Vercel Blob.

## How it works

Your iOS Shortcut POSTs whatever you shared to `/api/add` with a secret bearer
token. The server fishes the URL out of the shared text, asks the platform's
public oEmbed endpoint (Spotify/SoundCloud/YouTube) for title, art and artist —
or falls back to scraping Open Graph tags for everything else — then appends
the entry to `tracks.json` in Vercel Blob. Pages render on demand, so new
tracks show up as soon as the CDN lets them (see *Caveats*).

Editing happens in place on the front page once you're signed in. There is no
separate admin route.

## Where your data lives

One file: `tracklog/tracks.json` in a Vercel Blob store. That's the whole
database. `tracklog/hits.txt` holds the visitor counter beside it.

**It is permanent.** Vercel Blob is object storage with no TTL and no expiry —
objects persist until something deletes them. The store reports no retention
setting. Practically, the ways you could still lose the list are:

- deleting the Blob store or the Vercel project
- deleting entries yourself in the UI (immediate, no undo)
- a bug that overwrites the file

The third one is guarded. Because this is a read-modify-write store, a caller
that mistook a failed read for "the journal is empty" and then wrote would
destroy every existing entry. `readJournal()` therefore **throws** when the
journal can't be read or parsed, rather than returning an empty one; display
callers catch it and show a warning, and mutating callers let it propagate so
the write is abandoned. `/api/add` answers `503` and saves nothing.

Back it up whenever you like — it's one public URL and plain JSON:

```bash
curl -s "$(npx vercel blob list --rw-token "$BLOB_READ_WRITE_TOKEN" | grep -o 'https://\S*tracks.json')" > tracks-backup.json
```

## Deploying

The GitHub repo is connected to the Vercel project, so **`git push` deploys**:

```bash
git push
```

Note that `vercel deploy` from the CLI can fail with *"not a member of the
team"* when the local commit's author email isn't a Vercel member — pushing
avoids that entirely, since the integration attributes the deploy itself.

Setting this up from scratch: create the project, add a **Blob** store (access
must be **public** — `lib/store.ts` writes with `access: "public"`), set
`JOURNAL_SECRET` to a long random string (`openssl rand -hex 24`), then connect
the Git repo.

## The iOS Shortcut

The shortcut is a *generic URL receiver*. It has no Spotify integration and
there is no Spotify to pick anywhere — the "Receive" list holds **data types**,
not apps. Spotify appears on the other side: you share *to* the shortcut.

1. **Shortcuts** → **+** → name it `log track`.
2. In the shortcut's info/details panel, turn on **Show in Share Sheet**.
3. In the **"Receive … from Share Sheet"** block, allow **URLs** and **Text**.
   Both matter: Spotify sometimes shares a bare link and sometimes text with
   the link inside it.
4. **Ask for Input** → Text → `any notes?` → **Set Variable** `note`.
5. **Ask for Input** → Text → `dimension?` → **Set Variable** `mood`.
6. **Get Contents of URL**:
   - URL: `https://YOUR-APP.vercel.app/api/add`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR-JOURNAL-SECRET`
   - Request Body: **JSON**, three fields — `url` = **Shortcut Input**,
     `note` = `note`, `mood` = `mood`
7. Optional: **Get Dictionary Value** for key `logged`, then **Show
   Notification** with it, for a confirmation toast.

Then: Spotify → a song → **Share** → `log track`.

**Don't test with the ▶ button in the editor.** Run that way, *Shortcut Input*
is empty, so the server correctly answers `400 no url found`. Share from a
music app instead. If you get *"The network connection was lost"*, that's
iOS-side and usually transient — retry first, then check Private Relay, VPN or
Low Data Mode.

The field is still named `mood` on the wire so existing entries and the
shortcut keep working; the site just renders it as *"currently in X
dimension"*.

## Test without a phone

```bash
curl -X POST https://YOUR-APP.vercel.app/api/add -H "Authorization: Bearer YOUR-JOURNAL-SECRET" -H "Content-Type: application/json" -d '{"url":"https://open.spotify.com/track/YOUR_TRACK_ID","note":"testing","mood":"cautiously optimistic"}'
```

## Editing (keeper mode)

Open the `·` at the very bottom of the front page and enter your
`JOURNAL_SECRET` once. The session lasts a year.

The cookie holds `sha256("tracklog:v1:" + secret)`, never the secret itself, so
your password isn't sitting in the browser or replayed on every request.
Bumping that version prefix invalidates every session without changing the
password. The bearer token on `/api/add` still uses the raw secret, so the
shortcut is unaffected, and the hashed cookie value is deliberately *not*
accepted as a bearer.

Signed in, every track grows an `✎ edit` disclosure with title, artist, note
and dimension, plus a delete button. Logged-out visitors never receive that
markup, and every mutating action re-checks the cookie on the server — hiding
the controls is presentation, not the security boundary.

## Players

Tracks play inline. Hit `♪ play here` and an embed opens for Spotify,
SoundCloud, YouTube or Apple Music.

There is **no OAuth and no client ID**. SoundCloud plays in full for free;
Spotify serves its 30-second preview, or the full track if the visitor happens
to be signed in with Premium in that browser. Nothing about a visitor is
requested or stored.

Player URLs are rebuilt in `lib/embed.ts` from parsed pieces of the shared link
against a host allowlist, rather than injecting the provider's oEmbed HTML, so
`dangerouslySetInnerHTML` appears nowhere in the app. A provider can only ever
cause an iframe pointed at a known host.

Players start collapsed and the iframe is **mounted on demand**, so Spotify and
SoundCloud aren't contacted at all until someone chooses to play something. A
closed `<details>` does *not* achieve this — the browser loads the iframe
anyway, even with `loading="lazy"` — which is why the toggle is a small client
component. It needs JavaScript; without it the `▶ from <provider>` link beside
it still works.

## Local development

```bash
npm install
vercel link
vercel env pull .env.local
npm run dev
```

**Stop the dev server before `npm run build`.** Both write to `.next/`, so a
production build pulls the dev server's assets out from under it and the page
renders with no CSS at all. If it happens: stop dev, `rm -rf .next`, restart.

## Customising the look

The whole theme is CSS variables at the top of `app/globals.css` — `--face`,
`--gold`, `--lcd`, `--amber`, `--btn`. Fonts are system stacks: `--mono` for
chrome and titles (system mono, which renders far cleaner on iOS than Courier
New), `--ui` for notes.

Optional env vars: `NEXT_PUBLIC_SITE_TITLE`, `NEXT_PUBLIC_SITE_TAGLINE`,
`NEXT_PUBLIC_ABOUT`, `NEXT_PUBLIC_SITE_URL` (used in the RSS feed).
`NEXT_PUBLIC_` values are baked in at build time, so changing them needs a
redeploy.

## Caveats

- **Newly shared tracks can take up to 60 seconds to appear.** Blobs default to
  a 30-day CDN `max-age`; writes set `cacheControlMaxAge`, but Vercel clamps it
  to a 60s floor. A query-string cache-buster does not help — the CDN's cache
  key ignores the query string.
- **Spotify never returns an artist.** Its oEmbed response has no
  `author_name` field at all, so Spotify entries land with a blank artist and
  you fill it in. SoundCloud and YouTube do return it.
- Writes are read-modify-write on one JSON file. Fine for a single author; two
  tracks shared in the same second could race.
- The hit counter is real and lives in its own blob so visitor traffic never
  races with your posts. If the store is unreachable it shows 001337.
- The RSS feed is at `/feed.xml` (latest 50 entries).
- Your `JOURNAL_SECRET` sits in your shortcut in plain text. That's fine — it's
  your device — but treat it like a password and keep it long.
