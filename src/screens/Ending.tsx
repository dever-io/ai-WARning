import { BarPanel } from '../components/BarPanel';
import { buildBars } from '../game/bars';
import { ACCENT, DANGER, FACTION, GOOD } from '../game/theme';
import type { EndingView } from '../../shared/protocol';

const TONE_COLOR: Record<EndingView['tone'], string> = {
  good: GOOD,
  mixed: ACCENT,
  bad: DANGER,
};

export function Ending({ ending, onReset }: { ending: EndingView; onReset: () => void }) {
  const bars = buildBars(
    ending.meters.map((m) => ({ ...m, danger: m.danger })),
    null,
  );
  const tone = TONE_COLOR[ending.tone];

  return (
    <div className="panel-stack">
      <section className="end" style={{ borderColor: tone }}>
        <span className="tick tick-tl" aria-hidden="true" />
        <span className="tick tick-tr" aria-hidden="true" />
        <span className="tick tick-bl" aria-hidden="true" />
        <span className="tick tick-br" aria-hidden="true" />
        <div className="end-tag" style={{ color: tone }}>
          THREE DAYS LATER
        </div>
        <div>
          <div className="end-title">{ending.title}</div>
          <div className="end-reason">{ending.verdict}</div>
        </div>
        <BarPanel bars={bars} />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>YOUR RECORD</h2>
        </div>
        <div className="epilogue">
          <div className="epilogue-title">{ending.personal.title}</div>
          <p>{ending.personal.line}</p>
          <div className="epilogue-stats">
            <span>
              <b style={{ color: GOOD }}>{ending.personal.withMajority}</b> with the world
            </span>
            <span>
              <b style={{ color: DANGER }}>{ending.personal.against}</b> outvoted
            </span>
            <span>
              <b>{ending.personal.abstained}</b> abstained
            </span>
          </div>
        </div>
      </section>

      {ending.faction && (
        <section className="panel">
          <div className="panel-head">
            <h2 style={{ color: FACTION }}>{ending.faction.name}</h2>
          </div>
          <div className="epilogue">
            <div className="epilogue-title" style={{ color: FACTION }}>
              {ending.faction.title}
            </div>
            <p>{ending.faction.line}</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2>FINAL STANDINGS</h2>
        </div>
        <ol className="board">
          {ending.leaderboard.map((f, i) => (
            <li className="board-row" key={f.name}>
              <span className="board-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="board-name">{f.name}</span>
              <span className="board-num">{f.members}m</span>
              <span className="board-num">inf {f.influence}</span>
              <span className="board-num">coh {f.cohesion}</span>
            </li>
          ))}
        </ol>
      </section>

      <button type="button" className="btn btn-yes" onClick={onReset}>
        RUN A NEW EPOCH ▶
      </button>
    </div>
  );
}
