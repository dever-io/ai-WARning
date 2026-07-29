import { useEffect, useRef, useState } from 'react';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from `from` to `to` over `durationMs`, starting after `delayMs`.
 * Eases on the same curve as the bar it sits next to, so the number and the
 * fill arrive together.
 */
export function useCountTo(from: number, to: number, durationMs = 900, delayMs = 420): number {
  const [value, setValue] = useState(from);
  const frame = useRef(0);

  useEffect(() => {
    setValue(from);
    if (from === to) return;

    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const elapsed = now - start - delayMs;
      if (elapsed < 0) {
        frame.current = requestAnimationFrame(step);
        return;
      }
      const t = Math.min(1, elapsed / durationMs);
      setValue(Math.round(from + (to - from) * easeOut(t)));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    // rAF is paused while the tab is hidden, which would strand the number on
    // its old value. Timers keep running, so guarantee the final figure.
    const settle = window.setTimeout(() => setValue(to), delayMs + durationMs + 60);

    return () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(settle);
    };
  }, [from, to, durationMs, delayMs]);

  return value;
}
