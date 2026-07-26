import type { Dir } from '../../shared/protocol';

interface Props {
  yesLabel: string;
  noLabel: string;
  accent: string;
  disabled?: boolean;
  onChoose: (dir: Dir) => void;
  onPreview: (dir: Dir | null) => void;
}

export function Actions({ yesLabel, noLabel, accent, disabled, onChoose, onPreview }: Props) {
  return (
    <div className="actions">
      <button
        type="button"
        className="btn btn-no"
        disabled={disabled}
        aria-label={`${noLabel} (swipe left)`}
        onClick={() => onChoose('no')}
        onMouseEnter={() => onPreview('no')}
        onMouseLeave={() => onPreview(null)}
      >
        ◀ {noLabel}
      </button>
      <button
        type="button"
        className="btn btn-yes"
        disabled={disabled}
        style={{ background: accent, borderColor: accent }}
        aria-label={`${yesLabel} (swipe right)`}
        onClick={() => onChoose('yes')}
        onMouseEnter={() => onPreview('yes')}
        onMouseLeave={() => onPreview(null)}
      >
        {yesLabel} ▶
      </button>
    </div>
  );
}
