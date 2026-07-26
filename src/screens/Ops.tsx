import { useEffect, useMemo, useRef, useState } from 'react';
import { Actions } from '../components/Actions';
import { BarPanel } from '../components/BarPanel';
import { DecisionCard, type DecisionCardHandle } from '../components/DecisionCard';
import { Strip } from '../components/Strip';
import { TallyBar } from '../components/TallyBar';
import { buildBars } from '../game/bars';
import { ACCENT, CONS_NEUTRAL, DANGER, FACTION, GOOD } from '../game/theme';
import { formatCountdown } from '../hooks/useNow';
import type { Dir, GameState, Scope } from '../../shared/protocol';

const BRIEFING =
  'Three decisions a day, three days, one world. Right authorizes, left refuses — and everyone else is voting too.';

interface Props {
  state: GameState;
  remaining: number;
  onVote: (scope: Scope, dir: Dir) => void;
  onOpenFactions: () => void;
}

export function Ops({ state, remaining, onVote, onOpenFactions }: Props) {
  const [preview, setPreview] = useState<Dir | null>(null);
  const cardRef = useRef<DecisionCardHandle>(null);

  const worldPending = state.world.card !== null && state.world.myVote === null;
  const factionPending = state.faction?.card != null && state.faction.myVote === null;
  const active = worldPending ? state.world.card : factionPending ? state.faction!.card : null;
  const activeScope: Scope = worldPending ? 'world' : 'faction';

  // A pending decision from a different scope should never keep a stale preview.
  useEffect(() => setPreview(null), [active?.id, activeScope]);

  const worldFx = active?.scope === 'world' && preview ? active[preview].fx : null;
  const factionFx = active?.scope === 'faction' && preview ? active[preview].fx : null;

  const meterBars = useMemo(
    () => buildBars(state.meters.map((m) => ({ ...m, danger: m.danger })), worldFx),
    [state.meters, worldFx],
  );
  const statBars = useMemo(
    () =>
      state.faction
        ? buildBars(
            state.faction.stats.map((s) => ({ ...s, neutral: s.neutral })),
            factionFx,
            FACTION,
          )
        : [],
    [state.faction, factionFx],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      e.preventDefault();
      cardRef.current?.fly(e.key === 'ArrowRight' ? 'yes' : 'no');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const last = state.history.at(-1) ?? null;
  const accent = active?.scope === 'faction' ? FACTION : ACCENT;

  const peek =
    worldPending && state.faction?.card
      ? {
          chipLabel: state.faction.card.chipLabel,
          chipColor: state.faction.card.chipColor,
          title: state.faction.card.title,
        }
      : null;

  return (
    <>
      {/* Pinned: the live preview is useless if the meters scroll out of view. */}
      <div className="meters-sticky">
        <BarPanel bars={meterBars} />
      </div>

      {active?.scope === 'faction' && state.faction && (
        <div className="faction-inline">
          <div className="faction-inline-head">
            <span className="faction-inline-name" style={{ color: FACTION }}>
              {state.faction.name}
            </span>
            <span className="faction-inline-meta">{state.faction.members} members</span>
          </div>
          <BarPanel bars={statBars} compact />
        </div>
      )}

      {active ? (
        <>
          <DecisionCard
            ref={cardRef}
            card={active}
            peek={peek}
            accent={accent}
            danger={DANGER}
            preview={preview}
            onPreview={setPreview}
            onResolve={(dir) => {
              setPreview(null);
              onVote(activeScope, dir);
            }}
          />
          <Actions
            yesLabel={active.yes.label}
            noLabel={active.no.label}
            accent={accent}
            onChoose={(dir) => cardRef.current?.fly(dir)}
            onPreview={setPreview}
          />
        </>
      ) : (
        <Standby state={state} remaining={remaining} onOpenFactions={onOpenFactions} />
      )}

      <TallyBar
        tally={state.world.tally}
        yesLabel="FOR"
        noLabel="AGAINST"
        showBlocs
      />

      <Strip
        label={last ? 'LAST OUTCOME' : 'BRIEFING'}
        text={last ? last.note : BRIEFING}
        border={last ? (last.result === 'yes' ? GOOD : DANGER) : CONS_NEUTRAL}
        flash={last ? last.round : 'brief'}
      />

      <div className="legend">
        {active
          ? 'Drag or hover a button to preview the fallout. Your ballot is one of many — a bloc behind you counts for more.'
          : 'The world is still voting. Skip ahead with the dev bar if you do not want to wait.'}
      </div>
    </>
  );
}

function Standby({
  state,
  remaining,
  onOpenFactions,
}: {
  state: GameState;
  remaining: number;
  onOpenFactions: () => void;
}) {
  const worldVote = state.world.myVote;
  const factionVote = state.faction?.myVote ?? null;
  return (
    <section className="standby" aria-label="Standing by">
      <span className="tick tick-tl" aria-hidden="true" />
      <span className="tick tick-tr" aria-hidden="true" />
      <span className="tick tick-bl" aria-hidden="true" />
      <span className="tick tick-br" aria-hidden="true" />
      <div className="standby-tag">ORDERS FILED</div>
      <div className="standby-clock">{formatCountdown(remaining)}</div>
      <div className="standby-sub">until the count closes</div>
      <div className="standby-rows">
        <div className="standby-row">
          <span>WORLD BALLOT</span>
          <span style={{ color: worldVote === 'yes' ? ACCENT : DANGER }}>
            {worldVote ? (worldVote === 'yes' ? 'FOR' : 'AGAINST') : '—'}
          </span>
        </div>
        {state.faction ? (
          <div className="standby-row">
            <span>{state.faction.name}</span>
            <span style={{ color: factionVote === 'yes' ? FACTION : DANGER }}>
              {factionVote ? (factionVote === 'yes' ? 'FOR' : 'AGAINST') : '—'}
            </span>
          </div>
        ) : (
          <button type="button" className="standby-cta" onClick={onOpenFactions}>
            UNAFFILIATED · JOIN A BLOC TO VOTE WITH WEIGHT ▶
          </button>
        )}
      </div>
    </section>
  );
}
