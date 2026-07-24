import { meterDefs } from './data';
import { ACCENT, BAD_GHOST, DANGER, GOOD, GOOD_GHOST, NEUTRAL_DELTA } from './theme';
import type { Fx, MeterKey, Meters } from './types';

export const clamp = (v: number): number => Math.max(0, Math.min(100, v));

export function startMeters(): Meters {
  return Object.fromEntries(meterDefs.map((m) => [m.key, m.start])) as Meters;
}

export function applyChoice(meters: Meters, fx: Fx): Meters {
  const next = { ...meters };
  for (const [key, delta] of Object.entries(fx) as Array<[MeterKey, number]>) {
    next[key] = clamp(next[key] + delta);
  }
  return next;
}

const FAIL_NOTES: Record<MeterKey, string> = {
  pwr: 'AI Power hit 100. The system no longer needs your confirmation.',
  ctl: 'Control hit 0. Nobody is at the wheel anymore.',
  eco: 'Economy hit 0. The lights go out, city by city.',
  trs: 'Trust hit 0. No one believes the briefings anymore.',
  pln: 'Planet hit 0. There is nothing left to govern.',
};

/** A run is lost when AI Power reaches 100 or any other meter collapses to 0. */
export function failReason(meters: Meters): string | null {
  for (const d of meterDefs) {
    const v = meters[d.key];
    if (d.danger && v >= 100) return FAIL_NOTES[d.key];
    if (!d.danger && v <= 0) return FAIL_NOTES[d.key];
  }
  return null;
}

export interface MeterView {
  key: MeterKey;
  label: string;
  value: number;
  color: string;
  deltaLabel: string;
  deltaColor: string;
  ovLeft: number;
  ovWidth: number;
  ovColor: string;
}

/**
 * Meter render model, including the live consequence preview:
 * delta chip text/color plus the ghost-fill segment about to be gained or lost.
 */
export function buildMeterViews(meters: Meters, fx: Fx | null): MeterView[] {
  return meterDefs.map((d) => {
    const value = meters[d.key];
    const raw = fx?.[d.key] ?? 0;
    const target = clamp(value + raw);
    const active = fx !== null && raw !== 0;
    // "Good" means raw > 0 for every meter except pwr, where raw < 0 is good.
    const isGood = d.key === 'pwr' ? raw < 0 : raw > 0;
    const deltaColor = raw === 0 ? NEUTRAL_DELTA : isGood ? GOOD : DANGER;
    const deltaLabel = active ? (raw > 0 ? `+${raw}` : `−${Math.abs(raw)}`) : '';
    let ovLeft = 0;
    let ovWidth = 0;
    let ovColor = 'transparent';
    if (active) {
      ovColor = isGood ? GOOD_GHOST : BAD_GHOST;
      if (raw > 0) {
        ovLeft = value;
        ovWidth = target - value;
      } else {
        ovLeft = target;
        ovWidth = value - target;
      }
    }
    return {
      key: d.key,
      label: d.label,
      value,
      color: d.danger ? DANGER : ACCENT,
      deltaLabel,
      deltaColor,
      ovLeft: +ovLeft.toFixed(1),
      ovWidth: +ovWidth.toFixed(1),
      ovColor,
    };
  });
}
