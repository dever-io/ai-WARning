import { DANGER, GOOD } from '../game/theme';
import type { ArchivedWorld, EndingTone } from '../../shared/protocol';

export const TONE_COLOR: Record<EndingTone, string> = {
  good: GOOD,
  mixed: '#f4b23e',
  bad: DANGER,
};

/**
 * One square per finished world, oldest first — the whole archive at a glance,
 * in the width of a single line.
 */
export function WorldStrip({ worlds, max = 32 }: { worlds: ArchivedWorld[]; max?: number }) {
  if (worlds.length === 0) return null;
  const shown = worlds.slice(-max);
  return (
    <span className="wstrip" aria-hidden="true">
      {shown.map((w) => (
        <i
          key={w.n}
          className="wstrip-cell"
          style={{ background: TONE_COLOR[w.tone] }}
          title={`World ${w.n} — ${w.endingTitle}`}
        />
      ))}
    </span>
  );
}

/** Plain-language summary of how the worlds have gone, for screen readers too. */
export function archiveSummary(worlds: ArchivedWorld[]): string {
  const held = worlds.filter((w) => w.tone === 'good').length;
  if (worlds.length === 0) return 'No world has ended here yet. Yours is the first.';
  if (held === 0) return `${worlds.length} ended before yours. None held the leash.`;
  return `${worlds.length} ended before yours. ${held} held the leash.`;
}
