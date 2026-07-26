interface Props {
  label: string;
  text: string;
  border: string;
  /** Bump to replay the entrance animation. */
  flash?: string | number;
}

export function Strip({ label, text, border, flash }: Props) {
  return (
    <div key={flash} className="cons" role="status" aria-live="polite" style={{ borderLeftColor: border }}>
      <span className="cons-label">{label}</span>
      <span className="cons-text">{text}</span>
    </div>
  );
}
