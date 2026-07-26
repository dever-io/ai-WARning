import { useEffect, useState } from 'react';
import { api } from '../api/client';
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

      <section className="panel">
        <div className="panel-head">
          <h2>BLOC STANDINGS</h2>
          <span className="panel-note">Ranked by influence</span>
        </div>
        <ol className="board">
          {blocs.map((f, i) => (
            <li className={`board-row${f.isMine ? ' is-mine' : ''}`} key={f.id}>
              <span className="board-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="board-name">{f.name}</span>
              <span className="board-num">{f.members}m</span>
              <span className="board-num">inf {f.influence}</span>
              <span className="board-num">coh {f.cohesion}</span>
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
      <div className="log-fx">
        {Object.entries(record.fx).map(([key, delta]) => (
          <span key={key} style={{ color: fxColor(key, delta) }}>
            {key.toUpperCase()} {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
          </span>
        ))}
      </div>
    </li>
  );
}

function fxColor(key: string, delta: number): string {
  const good = key === 'pwr' ? delta < 0 : delta > 0;
  return good ? GOOD : DANGER;
}
