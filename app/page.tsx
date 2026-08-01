import { isAdmin } from "@/lib/auth";
import { embedFor } from "@/lib/embed";
import { bumpHits, readJournal, type Entry, type Journal } from "@/lib/store";
import { deleteEntry, login, logout, saveEntry } from "./actions";
import { Player } from "./player";

export const dynamic = "force-dynamic";

const TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g";
const TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE ||
  "a public log of songs that altered my brain chemistry";
const ABOUT = process.env.NEXT_PUBLIC_ABOUT || "";

// Collapsed by default: the players are tall, and a page of them would bury
// the notes. The toggle lives in a client component so the iframe is only
// mounted once asked for — see app/player.tsx for why.
function TrackPlayer({ entry }: { entry: Entry }) {
  const embed = embedFor(entry);
  if (!embed) return null;
  return (
    <Player src={embed.src} height={embed.height} title={embed.title} />
  );
}

function EditPanel({ entry }: { entry: Entry }) {
  return (
    <details className="edit">
      <summary className="crs">✎ edit</summary>
      <form action={saveEntry} className="editform">
        <input type="hidden" name="id" value={entry.id} />
        <label className="crs" htmlFor={`t-${entry.id}`}>
          title
        </label>
        <input id={`t-${entry.id}`} name="title" defaultValue={entry.title} />
        <label className="crs" htmlFor={`a-${entry.id}`}>
          artist
        </label>
        <input
          id={`a-${entry.id}`}
          name="artist"
          defaultValue={entry.artist ?? ""}
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
          mood
        </label>
        <input id={`m-${entry.id}`} name="mood" defaultValue={entry.mood ?? ""} />
        <div className="editactions">
          <button type="submit" formAction={deleteEntry} className="btn95 danger">
            delete
          </button>
          <button type="submit" className="btn95">
            save
          </button>
        </div>
      </form>
    </details>
  );
}

function TrackEntry({
  entry,
  index,
  authed,
}: {
  entry: Entry;
  index: number;
  authed: boolean;
}) {
  return (
    <article className="entry" id={entry.id}>
      <div className="card bvi">
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
            <p className="numline crs">
              <span className="tracknum">{String(index).padStart(2, "0")}.</span>
              <a
                className="permalink"
                href={`#${entry.id}`}
                aria-label="permalink"
              >
                #
              </a>
            </p>
            <h2 className="tt">{entry.title}</h2>
            {entry.artist && <p className="ta">{entry.artist}</p>}
            <p className="cardrow">
              <a
                className="provbtn crs"
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                ▶ from {entry.provider}
              </a>
            </p>
          </div>
        </div>

        <TrackPlayer entry={entry} />

        {(entry.note || entry.mood) && (
          <div className="cardnotes">
            {entry.note && <p className="note cms">{entry.note}</p>}
            {entry.mood && (
              <p className="moodline crs">
                current mood: <b>{entry.mood}</b>
              </p>
            )}
          </div>
        )}

        {authed && <EditPanel entry={entry} />}
      </div>
    </article>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const params = await searchParams;
  const authed = await isAdmin();

  let journal: Journal = { entries: [] };
  let storeError = false;
  try {
    journal = await readJournal();
  } catch {
    storeError = true;
  }
  const hits = await bumpHits();
  const digits = String(hits).padStart(6, "0").slice(-6).split("");

  const latest = journal.entries[0];
  const spinning = latest
    ? `now spinning: ${latest.title}${latest.artist ? ` — ${latest.artist}` : ""}`
    : "the turntable is empty... for now";

  return (
    <main className="col">
      <header className="masthead">
        <h1 className="site-title">{TITLE}</h1>
        <p className="tagline cms">{TAGLINE}</p>
      </header>
      <nav className="navrow crs">
        [ <a href="/">home</a> ] [ <a href="/feed.xml">rss</a> ]
      </nav>
      <div className="marquee crs" aria-hidden="true">
        <span>
          ♫ ♫ {spinning} ♫ ♫ {spinning} ♫ ♫
        </span>
      </div>

      {ABOUT && <div className="about bv cms">{ABOUT}</div>}

      {storeError && (
        <div className="setupwarn crs">
          can&apos;t reach the blob store — connect a Vercel Blob store to this
          project (or set BLOB_READ_WRITE_TOKEN locally) and reload.
        </div>
      )}

      {journal.entries.length === 0 && !storeError && (
        <p className="nothing cms">
          nothing logged yet... the silence is deafening.
          <br />
          share a track from your phone to begin the journal.
        </p>
      )}

      {journal.entries.map((entry, i) => (
        <TrackEntry
          key={entry.id}
          entry={entry}
          index={i + 1}
          authed={authed}
        />
      ))}

      <footer className="counterbox bvi">
        <p className="clabel crs">☆ you are visitor № ☆</p>
        <p className="digits" aria-label={`visitor number ${hits}`}>
          {digits.map((d, i) => (
            <span key={i} className="dig" aria-hidden="true">
              {d}
            </span>
          ))}
        </p>
        <p className="footlinks crs">
          <a href="/feed.xml">rss</a> · est. 2026 · made with ♥ on{" "}
          <a href="https://vercel.com">vercel</a>
        </p>

        {authed ? (
          <form action={logout} className="keeperbar crs">
            <span>♦ keeper mode</span>
            <button type="submit" className="btn95">
              log out
            </button>
          </form>
        ) : (
          <details className="keeper">
            <summary className="crs">·</summary>
            {params.bad && <p className="adm-bad crs">wrong password!!</p>}
            <form action={login} className="keeperlogin">
              <label className="crs" htmlFor="key">
                journal secret
              </label>
              <input id="key" name="key" type="password" />
              <button type="submit" className="btn95">
                let me in
              </button>
            </form>
          </details>
        )}
      </footer>
    </main>
  );
}
