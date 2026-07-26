import { ACCENT, DANGER } from '../game/theme';
import type { TallyView } from '../../shared/protocol';

interface Props {
  tally: TallyView;
  yesLabel: string;
  noLabel: string;
  accent?: string;
  /** Faction blocs only apply to the world vote. */
  showBlocs?: boolean;
}

export function TallyBar({ tally, yesLabel, noLabel, accent = ACCENT, showBlocs }: Props) {
  const total = tally.yes + tally.no;
  const yesPct = total > 0 ? (tally.yes / total) * 100 : 50;
  const lead = total > 0 ? Math.round((Math.abs(tally.yes - tally.no) / total) * 100) : 0;

  return (
    <div className="tally">
      <div className="tally-head">
        <span className="tally-side" style={{ color: DANGER }}>
          {noLabel} {tally.no}
        </span>
        <span className="tally-meta">
          {total > 0 ? `MANDATE ${lead}%` : 'NO BALLOTS YET'}
        </span>
        <span className="tally-side tally-side-right" style={{ color: accent }}>
          {tally.yes} {yesLabel}
        </span>
      </div>
      <div className="tally-track">
        {total > 0 && (
          <>
            <div className="tally-no" style={{ width: `${100 - yesPct}%`, background: DANGER }} />
            <div className="tally-yes" style={{ width: `${yesPct}%`, background: accent }} />
          </>
        )}
        <div className="tally-mid" />
      </div>
      <div className="tally-foot">
        <span>
          {tally.counted === 0
            ? 'awaiting ballots'
            : `${tally.counted} counted${
                tally.pending > 0 ? ` · ${tally.pending} still coming in` : ' · count closed'
              }`}
        </span>
      </div>
      {showBlocs && tally.blocs.length > 0 && (
        <div className="blocs">
          {tally.blocs.slice(0, 4).map((b) => (
            <span className="bloc" key={b.name}>
              <span className="bloc-name">{b.name}</span>
              <span
                className="bloc-weight"
                style={{ color: b.stance === 'yes' ? accent : DANGER }}
              >
                +{b.weight} {b.stance === 'yes' ? yesLabel : noLabel}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
