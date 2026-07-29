import { useEffect, useState } from 'react';
import { api, post, setToken } from '../api/client';
import { WorldStrip, archiveSummary } from '../components/WorldStrip';
import type { ArchiveView } from '../../shared/protocol';

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archive, setArchive] = useState<ArchiveView | null>(null);

  useEffect(() => {
    void api<ArchiveView>('/archive')
      .then(setArchive)
      .catch(() => setArchive(null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ token: string }>('/session', { handle: handle.trim().toLowerCase() });
      setToken(res.token);
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open a session.');
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <main className="board board-narrow">
        <header className="hud">
          <span className="hud-counter">
            {archive ? `WORLD ${archive.currentWorld}` : 'OPERATIONS ACCESS'}
          </span>
          <span className="hud-brand">OVERRIDE</span>
        </header>

        <section className="panel panel-intro">
          <span className="tick tick-tl" aria-hidden="true" />
          <span className="tick tick-tr" aria-hidden="true" />
          <span className="tick tick-bl" aria-hidden="true" />
          <span className="tick tick-br" aria-hidden="true" />
          <h1 className="intro-title">Three days. Nine decisions. One world.</h1>
          <p className="intro-body">
            Everyone alive votes on the same dilemma at the same time. Your ballot is one of
            hundreds — so find a bloc, hold it together, and swing the count. Right authorizes,
            left refuses.
          </p>
          <ul className="intro-list">
            <li>
              <b>Keep AI Power low.</b> Everything else — control, economy, trust, planet — you
              want high.
            </li>
            <li>
              <b>Blocs carry weight.</b> A unified faction adds votes on top of its members.
            </li>
            <li>
              <b>Three choices a day.</b> Miss the window and the world decides without you.
            </li>
          </ul>
        </section>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>CALLSIGN</span>
            <input
              autoFocus
              value={handle}
              maxLength={16}
              placeholder="operator"
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-yes" disabled={busy || handle.trim().length < 3}>
            ENTER THE ROOM ▶
          </button>
        </form>

        {archive && archive.worlds.length > 0 && (
          <div className="wline">
            <WorldStrip worlds={archive.worlds} />
            <span className="wline-text">{archiveSummary(archive.worlds)}</span>
          </div>
        )}

        <div className="legend">
          Local demo — no password, no email. The callsign only separates you from the crowd.
        </div>
      </main>
    </div>
  );
}
