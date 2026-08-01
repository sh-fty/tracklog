# trackl0g ★

A single-page public music journal with the soul of a 2003 Xanga. Share a track
from Spotify, SoundCloud, YouTube, Bandcamp, or Apple Music straight from your
iPhone's share sheet, optionally type a note and a current mood in the moment,
and it appears on your site seconds later — album art, title, artist, blinking
"new!!" badge, real hit counter, RSS feed, the works.

No music-platform API keys. No database. One JSON file in Vercel Blob.

## How it works

Your iOS Shortcut POSTs whatever you shared to `/api/add` with a secret bearer
token. The server fishes the URL out of the shared text, asks the platform's
public oEmbed endpoint (Spotify/SoundCloud/YouTube) for title, art, and embed
HTML — or falls back to scraping Open Graph tags for everything else — then
appends the entry to `tracks.json` in Vercel Blob. The page is rendered on
demand, so new tracks show up immediately. `/admin` (gated by the same secret)
lets you edit notes, moods, titles, and artists, or delete entries.

## Deploy

1. Push this folder to a new GitHub repo.
2. In Vercel: **Add New → Project**, import the repo, and deploy. (The first
   deploy will build fine but show a setup warning on the page — that's
   expected until step 3.)
3. In your Vercel project: **Storage → Create Database → Blob**, create a store
   and connect it to the project. This auto-injects `BLOB_READ_WRITE_TOKEN`.
4. In **Settings → Environment Variables**, add `JOURNAL_SECRET` — a long
   random string (`openssl rand -hex 24` makes a good one).
5. Redeploy (Deployments → ⋯ → Redeploy) so the new env vars take effect.

Optional cosmetic env vars (see `.env.example`): `NEXT_PUBLIC_SITE_TITLE`,
`NEXT_PUBLIC_SITE_TAGLINE`, `NEXT_PUBLIC_ABOUT` (shows a beveled about box),
`NEXT_PUBLIC_TIMEZONE` (default `America/New_York`),
`NEXT_PUBLIC_EMBED_PLAYERS` (`true` renders the platform's real embedded
player under each retro card), and `NEXT_PUBLIC_SITE_URL` (used in the RSS
feed). `NEXT_PUBLIC_` values are baked in at build time, so changing them
requires a redeploy.

## The iOS Shortcut

1. Open **Shortcuts** → **+** → name it something like "log track".
2. Tap the shortcut's info panel (ⓘ) → turn on **Show in Share Sheet**. In the
   "Receive" block that appears at the top, allow **URLs** and **Text** (Spotify
   sometimes shares text with the link inside it — the server handles both).
3. Add **Ask for Input** → Text → prompt: `any notes?` → tap the result and
   **Set Variable** named `note`. (Just tap Done to skip when sharing.)
4. Add another **Ask for Input** → Text → prompt: `current mood?` →
   **Set Variable** named `mood`.
5. Add **Get Contents of URL**:
   - URL: `https://YOUR-APP.vercel.app/api/add`
   - Method: **POST**
   - Headers: `Authorization` = `Bearer YOUR-JOURNAL-SECRET`
   - Request Body: **JSON** with three fields:
     - `url` = **Shortcut Input** (the magic variable)
     - `note` = `note` variable
     - `mood` = `mood` variable
6. (Optional but satisfying) Add **Get Dictionary Value** → key `logged` from
   Contents of URL, then **Show Notification** with that value — you'll get a
   "Midnight Aquifer — DJ Polyhedra" toast confirming the log.

Now open Spotify or SoundCloud, hit share on any track, scroll to your
shortcut, type a note, done.

## Test without a phone

```bash
curl -X POST https://YOUR-APP.vercel.app/api/add \
  -H "Authorization: Bearer YOUR-JOURNAL-SECRET" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://open.spotify.com/track/YOUR_TRACK_ID", "note": "testing testing", "mood": "cautiously optimistic"}'
```

## Editing entries

Visit `/admin` and enter your `JOURNAL_SECRET` once. The session lasts a year;
the cookie holds a hash derived from the secret rather than the secret itself,
so your password isn't sitting in the browser or replayed on every request.
Once in, you can rewrite notes and moods, fix titles or artists
(Spotify's oEmbed doesn't return artist names, so you may want to fill those
in), or delete entries. Deletes are immediate and there's no undo — it's a
journal, not a database.

## Local development

```bash
npm install
vercel link          # link to your Vercel project
vercel env pull .env.local   # pulls BLOB_READ_WRITE_TOKEN and JOURNAL_SECRET
npm run dev
```

Or skip the Vercel CLI and copy `.env.example` to `.env.local`, filling in a
Blob read-write token from your store's settings page.

## Customizing the look

The entire theme lives in `app/globals.css` — the palette is defined as CSS
variables at the top (`--sky`, `--pinky`, `--lime`...). Swap the hot pink for
lime green, make the starfield denser, add a tiled-GIF-style background — go
wild, that's the point. The fonts are deliberately web-safe 2003 stacks:
Times New Roman for display, Courier New for chrome, Comic Sans MS for your
notes (with Comic Neue loaded as a fallback for iPhones, which never shipped
Comic Sans — a historical injustice).

## Notes and honest caveats

- Writes are read-modify-write on one JSON file. For a single-author journal
  this is fine; if you somehow share two tracks in the same second, one could
  win. Lower stakes than a Xanga comment war.
- The hit counter is real and lives in its own blob so visitor traffic never
  races with your posts. If the store is unreachable it displays 001337, as
  is tradition.
- The RSS feed is at `/feed.xml` (latest 50 entries).
- Your `JOURNAL_SECRET` lives in your shortcut in plain text. That's fine —
  it's your device — but treat the secret like a password and make it long.
