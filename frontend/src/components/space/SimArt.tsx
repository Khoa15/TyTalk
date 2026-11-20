import { SIMS } from '../../lib/space/designArt';
import type { SimEvt } from '../../lib/space/types';

/** A simulation scene from the design board, drawn in a 200 x 200 box. */
export function SimScene({ evt, p, t }: { evt: SimEvt; p: number; t: number }) {
  const scene = SIMS[evt.id];
  return <g dangerouslySetInnerHTML={{ __html: scene ? scene.draw(t, p) : '' }} />;
}

export function simCaption(evt: SimEvt, p: number): string {
  return SIMS[evt.id]?.cap(p) ?? evt.id.replace(/_/g, ' ');
}
