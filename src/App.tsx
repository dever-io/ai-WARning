import { useEffect, useRef, useState } from 'react';
import { ActionButtons } from './components/ActionButtons';
import { CardStack, type CardStackHandle } from './components/CardStack';
import { ConsequenceStrip } from './components/ConsequenceStrip';
import { EndScreen } from './components/EndScreen';
import { Hud } from './components/Hud';
import { MeterPanel } from './components/MeterPanel';
import { choicesPerDay, deck } from './game/data';
import { buildMeterViews } from './game/logic';
import { useGame } from './game/useGame';
import type { Dir } from './game/types';

export default function App() {
  const { state, commit, restart } = useGame();
  const [preview, setPreview] = useState<Dir | null>(null);
  const stackRef = useRef<CardStackHandle>(null);

  const over = state.over !== null;
  const card = deck[state.idx % deck.length];
  const next = deck[(state.idx + 1) % deck.length];
  const fx = preview && !over ? card[preview].fx : null;
  const meters = buildMeterViews(state.meters, fx);

  const choose = (dir: Dir) => stackRef.current?.fly(dir);

  const handlePreview = (dir: Dir | null) => {
    if (dir !== null && stackRef.current?.isAnimating()) return;
    setPreview(dir);
  };

  const handleResolve = (dir: Dir) => {
    setPreview(null);
    commit(dir);
  };

  useEffect(() => {
    if (over) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stackRef.current?.fly('no');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stackRef.current?.fly('yes');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [over]);

  return (
    <div className="screen">
      <div className="grid-overlay" aria-hidden="true" />
      <main className="board">
        <Hud made={state.made} over={over} />
        <MeterPanel meters={meters} />
        {over ? (
          <EndScreen
            reason={state.over ?? ''}
            days={Math.max(1, Math.ceil(state.made / choicesPerDay))}
            made={state.made}
            onRestart={restart}
          />
        ) : (
          <>
            <CardStack
              ref={stackRef}
              idx={state.idx}
              card={card}
              next={next}
              preview={preview}
              onPreview={handlePreview}
              onResolve={handleResolve}
            />
            <ActionButtons onChoose={choose} onPreview={handlePreview} />
          </>
        )}
        <ConsequenceStrip last={state.last} flash={state.made} />
        {!over && (
          <div className="legend">
            Drag or hover a button to preview the fallout. Keep{' '}
            <span className="legend-danger">AI Power</span> low, the rest high.
          </div>
        )}
      </main>
    </div>
  );
}
