interface Props {
  reason: string;
  days: number;
  made: number;
  onRestart: () => void;
}

export function EndScreen({ reason, days, made, onRestart }: Props) {
  return (
    <section className="end" aria-label="Simulation terminated">
      <span className="tick tick-tl" aria-hidden="true" />
      <span className="tick tick-tr" aria-hidden="true" />
      <span className="tick tick-bl" aria-hidden="true" />
      <span className="tick tick-br" aria-hidden="true" />
      <div className="end-tag">SIMULATION TERMINATED</div>
      <div>
        <div className="end-title">SIGNAL LOST.</div>
        <div className="end-reason">{reason}</div>
      </div>
      <div className="end-stats">
        You held the line for {days} {days === 1 ? 'day' : 'days'} · {made}{' '}
        {made === 1 ? 'choice' : 'choices'}
      </div>
      <button type="button" className="btn btn-yes end-restart" onClick={onRestart}>
        REBOOT SIMULATION ▶
      </button>
    </section>
  );
}
