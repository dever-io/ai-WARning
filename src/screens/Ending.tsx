import { BarPanel } from '../components/BarPanel';
import { TONE_COLOR, WorldStrip } from '../components/WorldStrip';
import { buildBars } from '../game/bars';
import { DANGER, FACTION, GOOD } from '../game/theme';
import type { ArchiveView, EndingView, PlayerRecord } from '../../shared/protocol';

interface Props {
  ending: EndingView;
  archive: ArchiveView;
  record: PlayerRecord;
  onReset: () => void;
}

export function Ending({ ending, archive, record, onReset }: Props) {
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

      <ArchivePanel ending={ending} archive={archive} />

      <section className="panel">
        <div className="panel-head">
          <h2>YOUR RECORD</h2>
          {record.worlds > 0 && (
            <span className="panel-note">
              {record.worlds + 1}
              {ordinal(record.worlds + 1)} world for you
            </span>
          )}
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
          {record.worlds > 0 && (
            <div className="epilogue-stats epilogue-lifetime">
              <span>ACROSS ALL WORLDS</span>
              <span>
                <b>{record.ballots}</b> ballots
              </span>
              <span>
                <b>{record.ballots ? Math.round((record.withWorld / record.ballots) * 100) : 0}%</b>{' '}
                with the world
              </span>
            </div>
          )}
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
        <ol className="standings">
          {ending.leaderboard.map((f, i) => (
            <li className="standings-row" key={f.name}>
              <span className="standings-rank">{String(i + 1).padStart(2, '0')}</span>
              <span className="standings-name">{f.name}</span>
              <span className="standings-num">{f.members}m</span>
              <span className="standings-num">inf {f.influence}</span>
              <span className="standings-num">coh {f.cohesion}</span>
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

function ordinal(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/**
 * The world you just finished, laid against the ones before it. One metric —
 * final AI Power — because five bars per world would be a spreadsheet.
 */
function ArchivePanel({ ending, archive }: { ending: EndingView; archive: ArchiveView }) {
  const past = archive.worlds.slice(0, -1).slice(-4).reverse();
  const mine = archive.worlds.at(-1);
  const yours = mine?.pwr ?? ending.pwr;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>THE ARCHIVE</h2>
        <span className="panel-note">
          {archive.worlds.length} world{archive.worlds.length === 1 ? '' : 's'} on record
        </span>
      </div>

      <div className="arch-rows">
        <ArchRow label="YOURS" pwr={yours} tone={ending.tone} title={ending.title} mine />
        {past.map((w) => (
          <ArchRow key={w.n} label={String(w.n)} pwr={w.pwr} tone={w.tone} title={w.endingTitle} />
        ))}
      </div>

      {archive.medianPwr !== null && past.length > 0 && (
        <div className="arch-note">
          Median world ends at AI Power <b>{archive.medianPwr}</b>. Yours ended at <b>{yours}</b>.
        </div>
      )}

      {archive.tally.length > 0 && (
        <div className="arch-tally">
          {archive.tally.map((t) => (
            <span key={t.key} style={{ color: TONE_COLOR[t.tone] }}>
              {t.title.replace(/[.]$/, '').toLowerCase()} <b>{t.count}</b>
            </span>
          ))}
        </div>
      )}

      <WorldStrip worlds={archive.worlds} />
    </section>
  );
}

function ArchRow({
  label,
  pwr,
  tone,
  title,
  mine,
}: {
  label: string;
  pwr: number;
  tone: EndingView['tone'];
  title: string;
  mine?: boolean;
}) {
  return (
    <div className={`arch-row${mine ? ' is-mine' : ''}`} title={title}>
      <span className="arch-n">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pwr}%`, background: TONE_COLOR[tone] }} />
        <div className="meter-stripes" />
      </div>
      <span className="arch-pwr">{pwr}</span>
      <span className="arch-title">{title.replace(/[.]$/, '')}</span>
    </div>
  );
}
