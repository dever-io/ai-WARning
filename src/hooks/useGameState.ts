import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, clearToken, post } from '../api/client';
import type { Dir, GameState, Scope } from '../../shared/protocol';

const POLL_MS = 2000;

export interface GameApi {
  state: GameState | null;
  /** Offset between the server's epoch clock and this browser's clock. */
  skew: number;
  error: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  vote: (scope: Scope, dir: Dir) => Promise<void>;
  skip: (rounds?: number) => Promise<void>;
  reset: () => Promise<void>;
  onSignedOut: () => void;
}

export function useGameState(onSignedOut: () => void): GameApi {
  const [state, setState] = useState<GameState | null>(null);
  const [skew, setSkew] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const absorb = useCallback((next: GameState) => {
    setState(next);
    setSkew(next.now - Date.now());
    setError(null);
    setLoading(false);
  }, []);

  const handle = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        onSignedOut();
        return;
      }
      setError(err instanceof Error ? err.message : 'Lost contact with the server.');
      setLoading(false);
    },
    [onSignedOut],
  );

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      absorb(await api<GameState>('/state'));
    } catch (err) {
      handle(err);
    } finally {
      inFlight.current = false;
    }
  }, [absorb, handle]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const vote = useCallback(
    async (scope: Scope, dir: Dir) => {
      try {
        absorb(await post<GameState>('/vote', { scope, dir }));
      } catch (err) {
        // A 409 means the round moved on under us — resync rather than nag.
        if (err instanceof ApiError && err.status === 409) void refresh();
        else handle(err);
      }
    },
    [absorb, handle, refresh],
  );

  const skip = useCallback(
    async (rounds = 1) => {
      try {
        absorb(await post<GameState>('/dev/skip', { rounds }));
      } catch (err) {
        handle(err);
      }
    },
    [absorb, handle],
  );

  const reset = useCallback(async () => {
    try {
      const res = await post<{ token: string }>('/dev/reset');
      localStorage.setItem('override-token', res.token);
      await refresh();
    } catch (err) {
      handle(err);
    }
  }, [handle, refresh]);

  return { state, skew, error, loading, refresh, vote, skip, reset, onSignedOut };
}
