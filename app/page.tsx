import { isAdmin } from "@/lib/auth";
import { embedFor } from "@/lib/embed";
import { bumpHits, readJournal, type Journal } from "@/lib/store";
import { deleteEntry, login, logout, saveEntry } from "./actions";
import { TrackCard } from "./track-card";

export const dynamic = "force-dynamic";

const TITLE = process.env.NEXT_PUBLIC_SITE_TITLE || "trackl0g by ilygoose";
const TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE || "songs that alter my brain chemistry";
const ABOUT = process.env.NEXT_PUBLIC_ABOUT || "";

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

  return (
    <main className="col">
      <header className="masthead">
        <h1 className="site-title">{TITLE}</h1>
        <p className="tagline">{TAGLINE}</p>
      </header>
      <nav className="navrow crs">
        [ <a href="/">home</a> ] [ <a href="/feed.xml">rss</a> ]
      </nav>
      {ABOUT && <div className="about bv">{ABOUT}</div>}

      {storeError && (
        <div className="setupwarn crs">
          can&apos;t reach the blob store — connect a Vercel Blob store to this
          project (or set BLOB_READ_WRITE_TOKEN locally) and reload.
        </div>
      )}

      {journal.entries.length === 0 && !storeError && (
        <p className="nothing">empty in here...</p>
      )}

      {journal.entries.map((entry, i) => (
        <TrackCard
          key={entry.id}
          entry={entry}
          index={i + 1}
          authed={authed}
          current={i === 0}
          embed={embedFor(entry)}
          saveAction={saveEntry}
          deleteAction={deleteEntry}
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
