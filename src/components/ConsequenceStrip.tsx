import { CONS_NEUTRAL, DANGER, GOOD } from '../game/theme';
import type { LastChoice } from '../game/types';

const BRIEFING =
  'Three decisions a day. Every swipe moves the world — right to authorize, left to refuse.';

interface Props {
  last: LastChoice | null;
  /** Changes on every committed choice; keying on it replays the entrance animation. */
  flash: number;
}

export function ConsequenceStrip({ last, flash }: Props) {
  const border = last ? (last.dir === 'yes' ? GOOD : DANGER) : CONS_NEUTRAL;
  return (
    <div
      key={flash}
      className="cons"
      role="status"
      aria-live="polite"
      style={{ borderLeftColor: border }}
    >
      <span className="cons-label">{last ? 'OUTCOME' : 'BRIEFING'}</span>
      <span className="cons-text">{last ? last.note : BRIEFING}</span>
    </div>
  );
}
