import { useEffect, useState } from 'react';
import { ACCENT, DANGER, GOOD, NEUTRAL_DELTA } from '../game/theme';
import type { BriefingMeter, BriefingView } from '../../shared/protocol';

interface Props {
  briefing: BriefingView;
  onContinue: () => void;
  busy: boolean;
}

/** Green when the change went the way you want — down for AI Power, up for the rest. */
function deltaColor(m: BriefingMeter): string {
  const delta = m.after - m.before;
  if (delta === 0) return NEUTRAL_DELTA;
  return (m.danger ? delta < 0 : delta > 0) ? GOOD : DANGER;
}

export function Briefing({ briefing, onContinue, busy }: Props) {
  // Bars start at yesterday's opening values and animate to the new reality.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    const id = window.setTimeout(() => setSettled(true), 420);
    return () => window.clearTimeout(id);
  }, [briefing.coveredDay]);

  return (
    <div className="panel-stack">
      <section className="report">
        <span className="tick tick-tl" aria-hidden="true" />
        <span className="tick tick-tr" aria-hidden="true" />
        <span className="tick tick-bl" aria-hidden="true" />
        <span className="tick tick-br" aria-hidden="true" />
        <div className="report-tag">MORNING REPORT · DAY {briefing.day}</div>
        <div>
          <h1 className="report-title">What day {briefing.coveredDay} cost.</h1>
          <p className="report-sub">
            The count is in and the numbers are public again. Everything decided today stays
            sealed until tomorrow.
          </p>
        </div>

        <div className="report-meters">
          {briefing.meters.map((m) => {
            const delta = m.after - m.before;
            const shown = settled ? m.after : m.before;
            return (
              <div className="report-row" key={m.key}>
                <span className="meter-label">{m.label}</span>
                <div className="meter-track">
                  <div
                    className="meter-fill report-fill"
                    style={{ width: `${shown}%`, background: m.danger ? DANGER : ACCENT }}
                  />
                  <div className="meter-stripes" />
                </div>
                <span className="report-delta" style={{ color: deltaColor(m) }}>
                  {delta === 0 ? '—' : delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                </span>
                <span className="report-value">
                  <b>{shown}</b>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>THE RECORD</h2>
          <span className="panel-note">Day {briefing.coveredDay}</span>
        </div>
        <ol className="report-log">
          {briefing.rounds.map((r) => (
            <li key={r.round}>
              <div className="report-log-head">
                <span className="log-day">
                  D{r.day}·{r.slot}
                </span>
                <span
                  className="log-verdict"
                  style={{ color: r.result === 'yes' ? ACCENT : DANGER }}
                >
                  {r.resultLabel}
                </span>
                <span className="log-count">mandate {Math.round(r.mandate * 100)}%</span>
                {r.myVote === null ? (
                  <span className="log-mine log-abstain">ABSTAINED</span>
                ) : (
                  <span
                    className="log-mine"
                    style={{ color: r.myVote === r.result ? GOOD : DANGER }}
                  >
                    {r.myVote === r.result ? 'WITH YOU' : 'AGAINST YOU'}
                  </span>
                )}
              </div>
              <div className="report-log-title">{r.title}</div>
              <div className="log-fx">
                {Object.entries(r.fx).map(([key, delta]) => (
                  <span
                    key={key}
                    style={{ color: (key === 'pwr' ? delta < 0 : delta > 0) ? GOOD : DANGER }}
                  >
                    {key.toUpperCase()} {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <button type="button" className="btn btn-yes" disabled={busy} onClick={onContinue}>
        BEGIN DAY {briefing.day} ▶
      </button>
    </div>
  );
}
