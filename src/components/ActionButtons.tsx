import type { Dir } from '../game/types';

interface Props {
  onChoose: (dir: Dir) => void;
  onPreview: (dir: Dir | null) => void;
}

export function ActionButtons({ onChoose, onPreview }: Props) {
  return (
    <div className="actions">
      <button
        type="button"
        className="btn btn-no"
        aria-label="Refuse (swipe left)"
        onClick={() => onChoose('no')}
        onMouseEnter={() => onPreview('no')}
        onMouseLeave={() => onPreview(null)}
      >
        ◀ ABORT
      </button>
      <button
        type="button"
        className="btn btn-yes"
        aria-label="Authorize (swipe right)"
        onClick={() => onChoose('yes')}
        onMouseEnter={() => onPreview('yes')}
        onMouseLeave={() => onPreview(null)}
      >
        CONFIRM ▶
      </button>
    </div>
  );
}
