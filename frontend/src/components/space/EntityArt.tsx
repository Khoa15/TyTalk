import { asteroid, cometShower, flyer, orbitPose, place } from '../../lib/space/designArt';
import type { EntityKind } from '../../lib/space/types';

/** Markup for one summoned entity at time t (seconds). Comets are drawn as a shower, see SpaceLayer. */
export function entityMarkup(kind: EntityKind, t: number): string {
  switch (kind) {
    case 'comet':
      return cometShower(t, 0.5);
    case 'meteor':
      return flyer('meteor', t, 0.62);
    case 'asteroid':
      return place(50 + 6 * Math.sin(t * 0.6), 50 + 4 * Math.sin(t * 0.9), 0, 1, asteroid(t, 1.15));
    case 'rocket':
    case 'astronaut':
    case 'satellite':
    case 'probe':
      return orbitPose(kind, t);
  }
}

export function EntityGlyph({ kind, t }: { kind: EntityKind; t: number }) {
  return <g dangerouslySetInnerHTML={{ __html: entityMarkup(kind, t) }} />;
}
