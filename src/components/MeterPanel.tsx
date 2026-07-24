import type { MeterView } from '../game/logic';

export function MeterPanel({ meters }: { meters: MeterView[] }) {
  return (
    <div className="meters">
      {meters.map((m) => (
        <div className="meter-row" key={m.key}>
          <span className="meter-label">{m.label}</span>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${m.value}%`, background: m.color }} />
            <div
              className="meter-ghost"
              style={{ left: `${m.ovLeft}%`, width: `${m.ovWidth}%`, background: m.ovColor }}
            />
            <div className="meter-stripes" />
          </div>
          <span className="meter-delta" style={{ color: m.deltaColor }}>
            {m.deltaLabel}
          </span>
          <span className="meter-value">{m.value}</span>
        </div>
      ))}
    </div>
  );
}
