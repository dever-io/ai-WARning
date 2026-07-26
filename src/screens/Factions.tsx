import { useCallback, useEffect, useState } from 'react';
import { api, post } from '../api/client';
import { BarPanel } from '../components/BarPanel';
import { TallyBar } from '../components/TallyBar';
import { buildBars } from '../game/bars';
import { DANGER, FACTION, GOOD } from '../game/theme';
import type { Creed, FactionSummary, GameState } from '../../shared/protocol';

interface CreedInfo {
  key: Creed;
  label: string;
  blurb: string;
}

interface Props {
  state: GameState;
  onChanged: () => void;
}

export function Factions({ state, onChanged }: Props) {
  const [list, setList] = useState<FactionSummary[]>([]);
  const [creeds, setCreeds] = useState<CreedInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ factions: FactionSummary[]; creeds: CreedInfo[] }>('/factions');
      setList(res.factions);
      setCreeds(res.creeds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the blocs.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, state.faction?.id, state.epoch.round]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel-stack">
      {state.faction ? (
        <MyBloc state={state} busy={busy} onLeave={() => act(() => post('/factions/leave'))} />
      ) : (
        <CreateBloc
          creeds={creeds}
          busy={busy}
          onCreate={(name, tagline, creed) =>
            act(() => post('/factions', { name, tagline, creed }))
          }
        />
      )}

      {error && <div className="form-error">{error}</div>}

      <section className="panel">
        <div className="panel-head">
          <h2>ACTIVE BLOCS</h2>
          <span className="panel-note">Influence decides how much extra weight a bloc swings</span>
        </div>
        <div className="bloc-list">
          {list.map((f) => (
            <article className={`bloc-card${f.isMine ? ' is-mine' : ''}`} key={f.id}>
              <div className="bloc-card-head">
                <span className="bloc-card-name">{f.name}</span>
                <span className="bloc-card-creed">{f.creed.toUpperCase()}</span>
              </div>
              <div className="bloc-card-tagline">{f.tagline}</div>
              <div className="bloc-card-stats">
                <span>
                  <b>{f.members}</b> members
                </span>
                <span>
                  <b>{f.influence}</b> influence
                </span>
                <span>
                  <b>{f.cohesion}</b> cohesion
                </span>
                <span>
                  <b>+{f.clout}</b> max swing
                </span>
              </div>
              {!f.isMine && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => act(() => post('/factions/join', { id: f.id }))}
                >
                  {state.faction ? 'DEFECT HERE' : 'JOIN'}
                </button>
              )}
              {f.isMine && <div className="bloc-card-mine">YOUR BLOC</div>}
            </article>
          ))}
        </div>
      </section>

      <JoinByCode busy={busy} onJoin={(code) => act(() => post('/factions/join', { code }))} />
    </div>
  );
}

function MyBloc({
  state,
  busy,
  onLeave,
}: {
  state: GameState;
  busy: boolean;
  onLeave: () => void;
}) {
  const faction = state.faction!;
  const bars = buildBars(
    faction.stats.map((s) => ({ ...s, neutral: s.neutral })),
    null,
    FACTION,
  );
  return (
    <section className="panel panel-bloc">
      <div className="panel-head">
        <h2 style={{ color: FACTION }}>{faction.name}</h2>
        <span className="panel-note">{faction.creed.toUpperCase()}</span>
      </div>
      <p className="bloc-tagline">“{faction.tagline}”</p>

      <BarPanel bars={bars} />

      <div className="bloc-meta">
        <span>
          <b>{faction.members}</b> members
        </span>
        <span>
          INVITE CODE <b className="code">{faction.joinCode}</b>
        </span>
        {faction.isFounder && <span className="bloc-founder">FOUNDER</span>}
      </div>

      {faction.tally && faction.card && (
        <div className="bloc-vote">
          <div className="bloc-vote-title">{faction.card.title}</div>
          <TallyBar
            tally={faction.tally}
            yesLabel={faction.card.yes.label}
            noLabel={faction.card.no.label}
            accent={FACTION}
          />
        </div>
      )}

      {faction.lastResult && (
        <div className="bloc-last" style={{ borderLeftColor: faction.lastResult.result === 'yes' ? GOOD : DANGER }}>
          <span className="cons-label">LAST INTERNAL VOTE</span>
          <span className="cons-text">{faction.lastResult.note}</span>
        </div>
      )}

      <div className="bloc-roster">
        <div className="bloc-roster-head">
          ROSTER <span>{faction.roster.length} of {faction.members} shown</span>
        </div>
        <div className="roster-grid">
          {faction.roster.map((m) => (
            <span
              key={m.handle}
              className={`roster-chip${m.isBot ? '' : ' is-human'}`}
              title={m.vote ? `voted ${m.vote}` : 'no ballot yet'}
            >
              <i
                className="roster-dot"
                style={{
                  background: m.vote === 'yes' ? FACTION : m.vote === 'no' ? DANGER : '#39414d',
                }}
              />
              {m.handle}
              {m.isFounder ? ' ★' : ''}
            </span>
          ))}
        </div>
      </div>

      <button type="button" className="btn btn-ghost btn-danger" disabled={busy} onClick={onLeave}>
        LEAVE THE BLOC
      </button>
    </section>
  );
}

function CreateBloc({
  creeds,
  busy,
  onCreate,
}: {
  creeds: CreedInfo[];
  busy: boolean;
  onCreate: (name: string, tagline: string, creed: Creed) => void;
}) {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [creed, setCreed] = useState<Creed>('guardian');

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>FOUND A BLOC</h2>
        <span className="panel-note">A unified bloc adds weight to every world vote you cast</span>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate(name, tagline, creed);
        }}
      >
        <label className="field">
          <span>BANNER</span>
          <input
            value={name}
            maxLength={28}
            placeholder="THE LONG VIEW"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>CREED LINE</span>
          <input
            value={tagline}
            maxLength={90}
            placeholder="We read the whole contract before we sign."
            onChange={(e) => setTagline(e.target.value)}
          />
        </label>
        <div className="creeds">
          {creeds.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`creed${creed === c.key ? ' is-active' : ''}`}
              onClick={() => setCreed(c.key)}
            >
              <span className="creed-label">{c.label}</span>
              <span className="creed-blurb">{c.blurb}</span>
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-yes" disabled={busy || !name || !tagline}>
          RAISE THE BANNER ▶
        </button>
      </form>
    </section>
  );
}

function JoinByCode({ busy, onJoin }: { busy: boolean; onJoin: (code: string) => void }) {
  const [code, setCode] = useState('');
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>JOIN BY CODE</h2>
      </div>
      <form
        className="form form-row"
        onSubmit={(e) => {
          e.preventDefault();
          onJoin(code.trim().toUpperCase());
        }}
      >
        <input
          value={code}
          maxLength={6}
          placeholder="XK4P2M"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button type="submit" className="btn btn-ghost" disabled={busy || code.length < 4}>
          JOIN
        </button>
      </form>
    </section>
  );
}
