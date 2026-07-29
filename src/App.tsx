import { useCallback, useEffect, useState } from 'react';
import { getToken } from './api/client';
import { DevBar, Hud, Nav, type Tab } from './components/Chrome';
import { useGameState } from './hooks/useGameState';
import { useNow } from './hooks/useNow';
import { Briefing } from './screens/Briefing';
import { Ending } from './screens/Ending';
import { Factions } from './screens/Factions';
import { Ops } from './screens/Ops';
import { SignIn } from './screens/SignIn';
import { WorldLog } from './screens/WorldLog';

export default function App() {
  const [signedIn, setSignedIn] = useState(() => getToken() !== null);
  if (!signedIn) return <SignIn onSignedIn={() => setSignedIn(true)} />;
  return <Game onSignedOut={() => setSignedIn(false)} />;
}

function Game({ onSignedOut }: { onSignedOut: () => void }) {
  const game = useGameState(onSignedOut);
  const [tab, setTab] = useState<Tab>('ops');
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const { state, skew, error, loading, refresh, vote, ackBriefing, skip, reset } = game;

  // The epoch closing and the morning report both deserve the front screen.
  useEffect(() => {
    if (state?.epoch.status === 'ended') setTab('ops');
  }, [state?.epoch.status]);
  useEffect(() => {
    if (state?.briefing) setTab('ops');
  }, [state?.briefing?.coveredDay]);

  const runDev = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  if (loading && !state) {
    return (
      <div className="screen">
        <main className="board board-narrow">
          <div className="boot">ESTABLISHING LINK…</div>
        </main>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="screen">
        <main className="board board-narrow">
          <div className="form-error">{error ?? 'No signal from the server.'}</div>
          <button type="button" className="btn btn-yes" onClick={() => void refresh()}>
            RETRY
          </button>
        </main>
      </div>
    );
  }

  const remaining = state.epoch.roundEndsAt - (now + skew);
  const pendingOps =
    (state.world.card && state.world.myVote === null ? 1 : 0) +
    (state.faction?.card && state.faction.myVote === null ? 1 : 0);
  const ended = state.epoch.status === 'ended';

  return (
    <div className="screen">
      <main className="board">
        <Hud state={state} remaining={remaining} />
        <Nav
          tab={tab}
          onTab={setTab}
          factionName={state.faction?.name ?? null}
          pendingOps={ended ? 0 : pendingOps}
        />

        {error && <div className="form-error">{error}</div>}

        {tab === 'ops' &&
          (ended && state.ending ? (
            <Ending
              ending={state.ending}
              archive={state.archive}
              record={state.record}
              onReset={() => void runDev(reset)}
            />
          ) : state.briefing ? (
            <Briefing
              briefing={state.briefing}
              busy={busy}
              onContinue={() => void runDev(ackBriefing)}
            />
          ) : (
            <Ops
              state={state}
              remaining={remaining}
              onVote={(scope, dir) => void vote(scope, dir)}
              onOpenFactions={() => setTab('faction')}
            />
          ))}

        {tab === 'faction' && <Factions state={state} onChanged={() => void refresh()} />}
        {tab === 'world' && <WorldLog state={state} />}
      </main>

      {state.devTools && (
        <DevBar
          handle={state.user.handle}
          busy={busy}
          onSkip={(rounds) => void runDev(() => skip(rounds))}
          onReset={() => void runDev(reset)}
        />
      )}
    </div>
  );
}
