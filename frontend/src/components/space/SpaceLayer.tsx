import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import type { EntityEvt } from '../../lib/timelinePlayer';
import type { SimEvt } from '../../lib/space/types';
import { EntityGlyph } from './EntityArt';
import { SimScene, simCaption } from './SimArt';

interface Props {
  entities: { evt: EntityEvt; startedAt: number }[];
  sim: { evt: SimEvt; startedAt: number } | null;
  /** The element the orb rests in. Visuals are drawn over it, at its centre and size. */
  anchorRef: RefObject<HTMLElement>;
}

interface Box { left: number; top: number; width: number; height: number; cx: number; cy: number; size: number }

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Sim canvas width. It is wider than the orb and fits the viewport. */
const simWidth = () => Math.min(400, window.innerWidth - 40);
/** The canvas centre sits to the right of the orb's stage centre, so the orb (moved left) is never covered. */
const simShift = () => simWidth() * 0.5 - 10;
/** Sim centre x, kept inside the viewport so the canvas is never cut off at the edge. */
const simCentreX = (orbCx: number) => Math.min(orbCx + simShift(), window.innerWidth - simWidth() / 2 - 12);

/**
 * Cartoon entities and the current simulation, drawn where the Orb is (no modal).
 * A sim replaces the orb for its duration: the orb layer fades out via `body.space-sim-on`.
 * Progress comes from `startedAt`, so the store only changes when the set of visuals changes.
 * A comet entity is one comet; it is drawn as a shower, so `count` is not multiplied for comets.
 */
export function SpaceLayer({ entities, sim, anchorRef }: Props) {
  const [now, setNow] = useState(() => performance.now());
  const [box, setBox] = useState<Box | null>(null);
  const active = entities.length > 0 || sim !== null;

  useEffect(() => {
    document.body.classList.toggle('space-sim-on', sim !== null);
    return () => document.body.classList.remove('space-sim-on');
  }, [sim]);

  // Entities get the same stage as a sim: the orb steps left and the art sits on the right.
  useEffect(() => {
    document.body.classList.toggle('space-entities-on', entities.length > 0);
    return () => document.body.classList.remove('space-entities-on');
  }, [entities.length]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      const el = anchorRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        setBox({ left: r.left, top: r.top, width: r.width, height: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, size: r.width });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, anchorRef]);

  if (!active || !box) return null;
  const at = { left: box.cx, top: box.cy };

  return createPortal(
    <>
      {entities.length > 0 && (
        // Same square box as the sim, on the right of the orb: the orb steps left, so nothing covers it.
        <svg
          className="space-entities"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          style={{ left: simCentreX(box.cx) - simWidth() / 2, top: box.cy - simWidth() / 2, width: simWidth(), height: simWidth() }}
        >
          {entities.flatMap(({ evt, startedAt }) => {
            const copies = evt.kind === 'comet' ? 1 : evt.count;
            return Array.from({ length: copies }, (_, i) => (
              <EntityGlyph key={`${evt.kind}-${startedAt}-${i}`} kind={evt.kind} t={(now - startedAt) / 1000 + i * 0.7} />
            ));
          })}
        </svg>
      )}
      {sim && (() => {
        const p = clamp01((now - sim.startedAt) / sim.evt.duration_ms);
        return (
          <div className="space-sim" role="img" aria-label={simCaption(sim.evt, p)} style={{ left: simCentreX(box.cx), top: box.cy, width: simWidth() }}>
            <svg viewBox="0 0 200 200">
              <SimScene evt={sim.evt} p={p} t={(now - sim.startedAt) / 1000} />
            </svg>
            <p>{simCaption(sim.evt, p)}</p>
          </div>
        );
      })()}
    </>,
    document.body,
  );
}
