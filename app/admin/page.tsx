import { isAdmin } from "@/lib/auth";
import { readJournal } from "@/lib/store";
import { deleteEntry, login, logout, saveEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ bad?: string }>;
}) {
  const params = await searchParams;
  const authed = await isAdmin();

  if (!authed) {
    return (
      <main className="col">
        <header className="masthead">
          <h1 className="site-title">keeper&apos;s door</h1>
          <p className="tagline cms">members only!! (it&apos;s just you)</p>
        </header>
        <div className="adm-body">
          {params.bad && <p className="adm-bad">wrong password!!</p>}
          <form action={login} className="adm-login bv">
            <label className="crs" htmlFor="key">
              journal secret
            </label>
            <input id="key" name="key" type="password" autoFocus />
            <button type="submit" className="btn95">
              let me in
            </button>
          </form>
          <p className="adm-hint crs">
            (the same JOURNAL_SECRET your shortcut uses)
          </p>
        </div>
      </main>
    );
  }

  const journal = await readJournal();

  return (
    <main className="col">
      <header className="masthead">
        <h1 className="site-title">the archive room</h1>
        <p className="tagline cms">
          {journal.entries.length}{" "}
          {journal.entries.length === 1 ? "track" : "tracks"} logged
        </p>
      </header>
      <div className="adm-body">
        <div className="adm-top crs">
          <a href="/">← back to the journal</a>
          <form action={logout}>
            <button type="submit" className="btn95">
              log out
            </button>
          </form>
        </div>

        {journal.entries.length === 0 && (
          <p className="adm-hint cms">nothing here yet — go share a track!</p>
        )}

        {journal.entries.map((entry) => (
          <form key={entry.id} action={saveEntry} className="adm-entry bv">
            <input type="hidden" name="id" value={entry.id} />
            <div className="adm-head">
              {entry.art ? (
                <img src={entry.art} alt="" width={44} height={44} />
              ) : (
                <div className="art artfallback" aria-hidden="true">
                  <span />
                </div>
              )}
              <div className="who crs">
                {new Date(entry.addedAt).toLocaleDateString("en-US")} ·{" "}
                <a href={entry.url} target="_blank" rel="noopener noreferrer">
                  {entry.provider} ↗
                </a>
              </div>
            </div>
            <div className="adm-grid">
              <div>
                <label className="crs" htmlFor={`t-${entry.id}`}>
                  title
                </label>
                <input
                  id={`t-${entry.id}`}
                  name="title"
                  type="text"
                  defaultValue={entry.title}
                />
              </div>
              <div>
                <label className="crs" htmlFor={`a-${entry.id}`}>
                  artist
                </label>
                <input
                  id={`a-${entry.id}`}
                  name="artist"
                  type="text"
                  defaultValue={entry.artist ?? ""}
                />
              </div>
            </div>
            <div className="adm-note">
              <label className="crs" htmlFor={`n-${entry.id}`}>
                note
              </label>
              <textarea
                id={`n-${entry.id}`}
                name="note"
                defaultValue={entry.note ?? ""}
              />
            </div>
            <div className="adm-grid">
              <div>
                <label className="crs" htmlFor={`m-${entry.id}`}>
                  current mood
                </label>
                <input
                  id={`m-${entry.id}`}
                  name="mood"
                  type="text"
                  defaultValue={entry.mood ?? ""}
                />
              </div>
            </div>
            <div className="adm-actions">
              <button
                type="submit"
                formAction={deleteEntry}
                className="btn95 danger"
              >
                delete
              </button>
              <button type="submit" className="btn95">
                save
              </button>
            </div>
          </form>
        ))}
      </div>
    </main>
  );
}
