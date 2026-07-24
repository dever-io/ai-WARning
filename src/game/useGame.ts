import { useEffect, useState } from 'react';
import { deck } from './data';
import { applyChoice, failReason, startMeters } from './logic';
import type { Dir, GameState } from './types';

const SAVE_KEY = 'override-save-v1';

function freshState(): GameState {
  return { meters: startMeters(), idx: 0, made: 0, last: null, over: null };
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshState();
    const saved = JSON.parse(raw) as Partial<GameState>;
    if (
      typeof saved.idx !== 'number' ||
      typeof saved.made !== 'number' ||
      typeof saved.meters?.ctl !== 'number'
    ) {
      return freshState();
    }
    return { ...freshState(), ...(saved as GameState) };
  } catch {
    return freshState();
  }
}

export function useGame() {
  const [state, setState] = useState<GameState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode) — the run just won't persist.
    }
  }, [state]);

  const commit = (dir: Dir) => {
    setState((s) => {
      if (s.over) return s;
      const card = deck[s.idx % deck.length];
      const choice = dir === 'yes' ? card.yes : card.no;
      const meters = applyChoice(s.meters, choice.fx);
      return {
        meters,
        idx: s.idx + 1,
        made: s.made + 1,
        last: { dir, note: choice.note },
        over: failReason(meters),
      };
    });
  };

  const restart = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
    setState(freshState());
  };

  return { state, commit, restart };
}
