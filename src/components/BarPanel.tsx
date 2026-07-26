import type { BarView } from '../game/bars';

export function BarPanel({ bars, compact }: { bars: BarView[]; compact?: boolean }) {
  return (
    <div className={compact ? 'meters meters-compact' : 'meters'}>
      {bars.map((b) => (
        <div className="meter-row" key={b.key}>
          <span className="meter-label">{b.label}</span>
          <div className="meter-track">
            <div
              className={`meter-fill${b.previewing ? ' is-preview' : ''}`}
              style={{ width: `${b.fillWidth}%`, background: b.color }}
            />
            <div
              className="meter-ghost"
              style={{ left: `${b.ovLeft}%`, width: `${b.ovWidth}%`, background: b.ovColor }}
            />
            <div className="meter-stripes" />
          </div>
          <span className="meter-delta" style={{ color: b.deltaColor }}>
            {b.deltaLabel}
          </span>
          <span className="meter-value">{b.value}</span>
        </div>
      ))}
    </div>
  );
}
