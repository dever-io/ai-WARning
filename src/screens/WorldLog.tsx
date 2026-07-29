import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { TONE_COLOR, WorldStrip } from '../components/WorldStrip';
import { ACCENT, DANGER, GOOD } from '../game/theme';
import type { FactionSummary, GameState, RoundRecord } from '../../shared/protocol';

export function WorldLog({ state }: { state: GameState }) {
  const [blocs, setBlocs] = useState<FactionSummary[]>([]);

  useEffect(() => {
    void api<{ factions: FactionSummary[] }>('/factions')
      .then((r) => setBlocs(r.factions))
      .catch(() => setBlocs([]));
  }, [state.epoch.round, state.epoch.status]);

  return (
    <div className="panel-stack">
      <section className="panel">
        <div className="panel-head">
          <h2>DECISION LOG</h2>
          <span className="panel-note">
            {state.history.length} of {state.epoch.roundsTotal} resolved
            {state.sealed > 0 ? ` · ${state.sealed} sealed` : ''}
          </span>
        </div>
        {state.history.length === 0 ? (
          <p className="empty">Nothing has been decided yet. The first count is still open.</p>
        ) : (
          <ol className="log">
            {state.history.map((r) => (
              <LogRow key={r.round} record={r} />
            ))}
          </ol>
        )}
      </section>

      {state.archive.worlds.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>PAST WORLDS</h2>
            <span className="panel-note">
              {state.archive.worlds.length} on record · you are world{' '}
              {state.archive.currentWorld}
            </span>
          </div>
          <ol className="standings">
            {[...state.archive.worlds].reverse().map((w) => (
              <li className="standings-row" key={w.n}>
                <span className="standings-rank">{String(w.n).padStart(2, '0')}</span>
                <span className="standings-name" style={{ color: TONE_COLOR[w.tone] }}>
                  {w.endingTitle.replace(/[.]$/, '')}
                </span>
                <span className="standings-num">pwr {w.pwr}</span>
                <span className="standings-num">{w.humans}p</span>
              </li>
            ))}
          </ol>
          <WorldStrip worlds={state.archive.worlds} />
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>BLOC STANDINGS</h2>
          <span className="panel-note">Ranked by influence</span>
        </div>
        <ol className="standings">
          {blocs.map((f, i) => (
            <li className={`standings-row${f.isMine ? ' is-mine' : ''}`} key={f.id}>
              <span className="standings-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="standings-name">{f.name}</span>
              <span className="standings-num">{f.members}m</span>
              <span className="standings-num">inf {f.influence}</span>
              <span className="standings-num">coh {f.cohesion}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function LogRow({ record }: { record: RoundRecord }) {
  const agreed = record.myVote === null ? null : record.myVote === record.result;
  return (
    <li className="log-row">
      <div className="log-head">
        <span className="log-day">
          D{record.day}·{record.slot}
        </span>
        <span className="log-chip" style={{ color: record.chipColor }}>
          {record.chipLabel}
        </span>
        <span className="log-src">{record.src}</span>
      </div>
      <div className="log-title">{record.title}</div>
      <div className="log-result">
        <span
          className="log-verdict"
          style={{ color: record.result === 'yes' ? ACCENT : DANGER }}
        >
          {record.resultLabel}
        </span>
        <span className="log-count">
          {record.yes} for · {record.no} against · mandate {Math.round(record.mandate * 100)}%
        </span>
        {agreed === null ? (
          <span className="log-mine log-abstain">YOU ABSTAINED</span>
        ) : (
          <span className="log-mine" style={{ color: agreed ? GOOD : DANGER }}>
            {agreed ? 'YOU AGREED' : 'YOU WERE OUTVOTED'}
          </span>
        )}
      </div>
      <div className="log-note">{record.note}</div>
      {record.reported ? (
        <div className="log-fx">
          {Object.entries(record.fx).map(([key, delta]) => (
            <span key={key} style={{ color: fxColor(key, delta) }}>
              {key.toUpperCase()} {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
            </span>
          ))}
        </div>
      ) : (
        <div className="log-sealed">IMPACT SEALED · REPORTED TOMORROW MORNING</div>
      )}
      {record.precedent && <Precedent p={record.precedent} result={record.result} />}
    </li>
  );
}

function fxColor(key: string, delta: number): string {
  const good = key === 'pwr' ? delta < 0 : delta > 0;
  return good ? GOOD : DANGER;
}

/**
 * How earlier worlds settled the same dilemma. Shown only on rounds that are
 * already decided, so it can never tip a pending choice.
 */
function Precedent({
  p,
  result,
}: {
  p: { worlds: number; yes: number; no: number };
  result: RoundRecord['result'];
}) {
  const same = result === 'yes' ? p.yes : p.no;
  const verb = result === 'yes' ? 'authorized' : 'refused';
  const rare = same * 2 < p.worlds;
  return (
    <div className="log-precedent">
      {p.worlds} past world{p.worlds === 1 ? '' : 's'} faced this ·{' '}
      <b style={{ color: rare ? ACCENT : '#7b8593' }}>
        {same} of {p.worlds} {verb} it too
      </b>
      {rare && <span className="log-rare"> · this world broke with them</span>}
    </div>
  );
}
