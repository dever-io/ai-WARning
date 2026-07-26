import { formatCountdown } from '../hooks/useNow';
import type { GameState } from '../../shared/protocol';

export type Tab = 'ops' | 'faction' | 'world';

export function Hud({ state, remaining }: { state: GameState; remaining: number }) {
  const { epoch } = state;
  const ended = epoch.status === 'ended';
  return (
    <header className="hud">
      <span className="hud-counter">
        {ended
          ? 'EPOCH CLOSED'
          : `DAY ${epoch.day}/${epoch.daysTotal} · CHOICE ${epoch.slot}/3`}
      </span>
      {/* The window can close a beat before the next poll lands — say so rather
          than sitting on a frozen 00:00. */}
      <span className="hud-mid">
        {ended ? '' : remaining > 0 ? formatCountdown(remaining) : 'COUNTING…'}
      </span>
      <span className="hud-brand">OVERRIDE</span>
    </header>
  );
}

interface NavProps {
  tab: Tab;
  onTab: (tab: Tab) => void;
  factionName: string | null;
  pendingOps: number;
}

export function Nav({ tab, onTab, factionName, pendingOps }: NavProps) {
  const items: Array<{ key: Tab; label: string; badge?: number }> = [
    { key: 'ops', label: 'OPS', badge: pendingOps },
    { key: 'faction', label: factionName ? 'BLOC' : 'FACTIONS' },
    { key: 'world', label: 'WORLD' },
  ];
  return (
    <nav className="nav" aria-label="Sections">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`nav-tab${tab === item.key ? ' is-active' : ''}`}
          aria-current={tab === item.key ? 'page' : undefined}
          onClick={() => onTab(item.key)}
        >
          {item.label}
          {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

interface DevBarProps {
  onSkip: (rounds: number) => void;
  onReset: () => void;
  busy: boolean;
  handle: string;
}

export function DevBar({ onSkip, onReset, busy, handle }: DevBarProps) {
  return (
    <div className="devbar">
      <span className="devbar-tag">DEV · {handle}</span>
      <button type="button" onClick={() => onSkip(1)} disabled={busy}>
        SKIP CHOICE
      </button>
      <button type="button" onClick={() => onSkip(3)} disabled={busy}>
        SKIP DAY
      </button>
      <button type="button" className="devbar-danger" onClick={onReset} disabled={busy}>
        RESET WORLD
      </button>
    </div>
  );
}
