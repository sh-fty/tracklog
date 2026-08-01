import { bumpHits, readJournal, type Entry, type Journal } from "@/lib/store";

export const dynamic = "force-dynamic";

const TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g";
const TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE ||
  "a public log of songs that altered my brain chemistry";
const ABOUT = process.env.NEXT_PUBLIC_ABOUT || "";
const TZ = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York";
const EMBEDS = process.env.NEXT_PUBLIC_EMBED_PLAYERS === "true";

function stamp(iso: string): string {
  return new Date(iso)
    .toLocaleString("en-US", {
      timeZone: TZ,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    .toLowerCase()
    .replace(/,\s*/g, " · ");
}

function TrackEntry({ entry }: { entry: Entry }) {
  return (
    <article className="entry" id={entry.id}>
      <p className="dateline crs">{stamp(entry.addedAt)}</p>
      <div className="rule" />
      <div className="card bv">
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
      {EMBEDS && entry.embedHtml && (
        <div
          className="embed"
          dangerouslySetInnerHTML={{ __html: entry.embedHtml }}
        />
      )}
      {entry.note && <p className="note cms">{entry.note}</p>}
      <p className="moodline crs">
        {entry.mood && (
          <>
            current mood: <b>{entry.mood}</b>
            {" ★ "}
          </>
        )}
        <a href={`#${entry.id}`}>#</a>
      </p>
    </article>
  );
}

export default async function Home() {
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
        <h1 className="site-title">
          <span className="deco">★·.·´¯`·.·★ </span>
          {TITLE}
          <span className="deco"> ★·.·´¯`·.·★</span>
        </h1>
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
        <div key={entry.id}>
          {i > 0 && <div className="entrysep" />}
          <TrackEntry entry={entry} />
        </div>
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
      </footer>
    </main>
  );
}
