import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { categories } from '../game/data';
import type { Card, Dir } from '../game/types';

export interface CardStackHandle {
  fly: (dir: Dir) => void;
  isAnimating: () => boolean;
}

interface Props {
  idx: number;
  card: Card;
  next: Card;
  preview: Dir | null;
  onPreview: (dir: Dir | null) => void;
  onResolve: (dir: Dir) => void;
}

const SWIPE_THRESHOLD = 110;
const PREVIEW_DEADZONE = 18;
const FLY_MS = 390;

interface DragState {
  x0: number;
  y0: number;
  dx: number;
  active: boolean;
}

export const CardStack = forwardRef<CardStackHandle, Props>(function CardStack(
  { idx, card, next, preview, onPreview, onResolve },
  ref,
) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const animRef = useRef(false);
  const pdirRef = useRef<Dir | null>(null);

  const stamp = (name: Dir) =>
    nodeRef.current?.querySelector<HTMLElement>(`[data-stamp="${name}"]`) ?? null;

  // A new card slides in with a clean slate after the fly-out.
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.transition = 'none';
    node.style.transform = 'translate(0,0) rotate(0deg)';
    node.style.opacity = '1';
    const yes = stamp('yes');
    const no = stamp('no');
    if (yes) yes.style.opacity = '0';
    if (no) no.style.opacity = '0';
  }, [idx]);

  // Hovering a button (not dragging) shows the matching stamp at half strength.
  useEffect(() => {
    if (animRef.current || dragRef.current?.active) return;
    const yes = stamp('yes');
    const no = stamp('no');
    if (yes) yes.style.opacity = preview === 'yes' ? '0.5' : '0';
    if (no) no.style.opacity = preview === 'no' ? '0.5' : '0';
  }, [preview]);

  const fly = (dir: Dir) => {
    const node = nodeRef.current;
    if (animRef.current || !node) return;
    animRef.current = true;
    const sign = dir === 'yes' ? 1 : -1;
    const st = stamp(dir);
    if (st) st.style.opacity = '1';
    node.style.transition = 'transform .4s ease-in, opacity .4s ease-in';
    node.style.transform = `translate(${sign * 140}%, -6%) rotate(${sign * 18}deg)`;
    node.style.opacity = '0';
    window.setTimeout(() => {
      animRef.current = false;
      dragRef.current = null;
      pdirRef.current = null;
      onResolve(dir);
    }, FLY_MS);
  };

  useImperativeHandle(ref, () => ({ fly, isAnimating: () => animRef.current }));

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (animRef.current || !nodeRef.current) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can fail on synthetic events — dragging still works.
    }
    dragRef.current = { x0: e.clientX, y0: e.clientY, dx: 0, active: true };
    pdirRef.current = null;
    nodeRef.current.style.transition = 'none';
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const node = nodeRef.current;
    if (!drag?.active || !node || animRef.current) return;
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    drag.dx = dx;
    node.style.transform = `translate(${dx}px, ${dy * 0.14}px) rotate(${dx * 0.05}deg)`;
    const dir: Dir | null = dx > PREVIEW_DEADZONE ? 'yes' : dx < -PREVIEW_DEADZONE ? 'no' : null;
    if (dir !== pdirRef.current) {
      pdirRef.current = dir;
      onPreview(dir);
    }
    const t = Math.max(-1, Math.min(1, dx / 120));
    const yes = stamp('yes');
    const no = stamp('no');
    if (yes) yes.style.opacity = String(Math.max(0, t));
    if (no) no.style.opacity = String(Math.max(0, -t));
  };

  const snapBack = () => {
    const node = nodeRef.current;
    if (!node) return;
    node.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1)';
    node.style.transform = 'translate(0,0) rotate(0deg)';
    const yes = stamp('yes');
    const no = stamp('no');
    if (yes) yes.style.opacity = '0';
    if (no) no.style.opacity = '0';
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    drag.active = false;
    pdirRef.current = null;
    if (Math.abs(drag.dx) > SWIPE_THRESHOLD && !animRef.current) {
      fly(drag.dx > 0 ? 'yes' : 'no');
    } else {
      snapBack();
      onPreview(null);
    }
  };

  const cardCat = categories[card.cat];
  const nextCat = categories[next.cat];

  return (
    <div className="stack">
      <div className="card-next" aria-hidden="true">
        <span className="card-next-cat" style={{ color: nextCat.color }}>
          {nextCat.label}
        </span>
        <div className="card-next-title">{next.title}</div>
      </div>
      <div
        ref={nodeRef}
        className="card"
        role="group"
        aria-label={`Dilemma from ${card.src}: ${card.title}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="tick tick-tl" aria-hidden="true" />
        <span className="tick tick-tr" aria-hidden="true" />
        <span className="tick tick-bl" aria-hidden="true" />
        <span className="tick tick-br" aria-hidden="true" />
        <div className="stamp stamp-yes" data-stamp="yes" aria-hidden="true">
          CONFIRM
        </div>
        <div className="stamp stamp-no" data-stamp="no" aria-hidden="true">
          ABORT
        </div>

        <div className="card-head">
          <span className="card-chip" style={{ color: cardCat.color }}>
            <span className="chip-dot" style={{ background: cardCat.color }} />
            {cardCat.label}
          </span>
          <span className="card-src">{card.src}</span>
        </div>
        <div>
          <div className="card-title">{card.title}</div>
          <div className="card-ctx">{card.ctx}</div>
        </div>
        <div className="card-hints">
          <span>◀ ABORT</span>
          <span>DRAG · ← →</span>
          <span>CONFIRM ▶</span>
        </div>
      </div>
    </div>
  );
});
