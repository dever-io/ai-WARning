import {
  ACCENT,
  BAD_GHOST,
  DANGER,
  FACTION,
  FACTION_GHOST,
  GOOD,
  GOOD_GHOST,
  NEUTRAL_DELTA,
} from './theme';

export interface BarSource {
  key: string;
  label: string;
  value: number;
  /** Lower is better (AI Power). */
  danger?: boolean;
  /** No good direction — a position, not a score (Doctrine). */
  neutral?: boolean;
}

export interface BarView {
  key: string;
  label: string;
  value: number;
  /**
   * Rendered fill width. On a negative preview the fill retracts to the target
   * so the at-risk slice pulses over the dark track — a tint layered on the
   * bright fill is unreadable.
   */
  fillWidth: number;
  previewing: boolean;
  color: string;
  deltaLabel: string;
  deltaColor: string;
  ovLeft: number;
  ovWidth: number;
  ovColor: string;
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function buildBars(
  sources: BarSource[],
  fx: Record<string, number> | null,
  accent = ACCENT,
): BarView[] {
  return sources.map((s) => {
    const raw = fx?.[s.key] ?? 0;
    const target = clamp(s.value + raw);
    const active = fx !== null && raw !== 0;
    const isGood = s.danger ? raw < 0 : raw > 0;
    const neutral = s.neutral === true;

    const deltaColor = raw === 0 ? NEUTRAL_DELTA : neutral ? FACTION : isGood ? GOOD : DANGER;
    const deltaLabel = active ? (raw > 0 ? `+${raw}` : `−${Math.abs(raw)}`) : '';

    let ovLeft = 0;
    let ovWidth = 0;
    let ovColor = 'transparent';
    if (active) {
      ovColor = neutral ? FACTION_GHOST : isGood ? GOOD_GHOST : BAD_GHOST;
      if (raw > 0) {
        ovLeft = s.value;
        ovWidth = target - s.value;
      } else {
        ovLeft = target;
        ovWidth = s.value - target;
      }
    }

    return {
      key: s.key,
      label: s.label,
      value: s.value,
      fillWidth: active && raw < 0 ? target : s.value,
      previewing: active,
      color: s.danger ? DANGER : neutral ? FACTION : accent,
      deltaLabel,
      deltaColor,
      ovLeft: +ovLeft.toFixed(1),
      ovWidth: +ovWidth.toFixed(1),
      ovColor,
    };
  });
}
