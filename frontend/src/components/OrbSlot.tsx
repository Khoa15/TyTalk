import { useEffect, useRef } from 'react';

import type { OrbState } from './orb/TyTalkOrb';
import type { OrbForm } from '../lib/space/types';
import { useOrbSlotApi } from './RouteStage';
import type { Route } from '../lib/transitionGraph';

/** Marks where the persistent orb rests on this page. The orb itself lives in RouteStage. */
export function OrbSlot({
  route, size, state = 'idle', form = 'orb', expressiveness = 0.5, className,
}: { route: Route; size: number; state?: OrbState; form?: OrbForm; expressiveness?: number; className?: string }) {
  const api = useOrbSlotApi();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !api) return;
    api.register(route, el, { state, form, expressiveness, size });
    return () => api.unregister(route, el);
    // Registration follows the route; state changes go through update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, route]);

  useEffect(() => {
    if (api) api.update(route, { state, form, expressiveness, size });
  }, [api, route, state, form, expressiveness, size]);

  return <div ref={ref} className={`orb-slot${className ? ' ' + className : ''}`} style={{ width: size, height: size }} aria-hidden="true" />;
}
