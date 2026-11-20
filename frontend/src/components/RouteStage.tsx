import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Routes, useLocation } from 'react-router-dom';

import { TyTalkOrb, type OrbState } from './orb/TyTalkOrb';
import { normalizeRoute, TransitionController, type Route } from '../lib/transitionGraph';
import type { OrbForm } from '../lib/space/types';

export interface SlotInfo { state: OrbState; form?: OrbForm; expressiveness: number; size: number }
interface SlotApi {
  register: (route: Route, el: HTMLDivElement, info: SlotInfo) => void;
  update: (route: Route, info: SlotInfo) => void;
  unregister: (route: Route, el: HTMLDivElement) => void;
}

const SlotContext = createContext<SlotApi | null>(null);
const OrbTransitionContext = createContext<OrbState | null>(null);

export function useOrbSlotApi(): SlotApi | null {
  return useContext(SlotContext);
}

/** The orb state of the transition now playing. Null when no transition is running. */
export function useTransitionOrb(): OrbState | null {
  return useContext(OrbTransitionContext);
}

const ORB_BASE = 240; // the one orb element is always this size; slots scale it to their own size
const ORB_SPRING = { omega: 14, zeta: 0.9 };
const STRETCH_PER_PX_S = 0.00025; // px/s of travel speed -> stretch
const STRETCH_MAX = 0.35;

/**
 * One persistent Orb. It is never unmounted during navigation: each page only marks a slot,
 * and the orb springs from its current position to the slot of the route on screen.
 */
export function RouteStage({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [shown, setShown] = useState<Route>(() => normalizeRoute(location.pathname));
  const [slots, setSlots] = useState<Partial<Record<Route, SlotInfo>>>({});
  const [orbState, setOrbState] = useState<OrbState | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const orbLayerRef = useRef<HTMLDivElement>(null);
  const shownRef = useRef<Route>(shown);
  const slotEls = useRef(new Map<Route, HTMLDivElement>());
  const controllerRef = useRef<TransitionController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new TransitionController((to) => {
      shownRef.current = to;
      setShown(to);
    });
  }

  const register = useCallback((route: Route, el: HTMLDivElement, info: SlotInfo) => {
    slotEls.current.set(route, el);
    setSlots((prev) => ({ ...prev, [route]: info }));
  }, []);

  const update = useCallback((route: Route, info: SlotInfo) => {
    setSlots((prev) => {
      const cur = prev[route];
      if (cur && cur.state === info.state && cur.expressiveness === info.expressiveness && cur.size === info.size && cur.form === info.form) return prev;
      return { ...prev, [route]: info };
    });
  }, []);

  const unregister = useCallback((route: Route, el: HTMLDivElement) => {
    if (slotEls.current.get(route) === el) slotEls.current.delete(route);
    setSlots((prev) => {
      if (!(route in prev)) return prev;
      const next = { ...prev };
      delete next[route];
      return next;
    });
  }, []);

  // A navigation starts (or retargets) the stage motion from whatever route is on screen.
  useEffect(() => {
    const to = normalizeRoute(location.pathname);
    if (to !== shownRef.current || controllerRef.current?.currentPhase !== 'idle') {
      controllerRef.current?.request(shownRef.current, to);
    }
  }, [location.pathname]);

  // One loop: moves the page stage, springs the orb to the slot on screen, and publishes the edge's orb state.
  useEffect(() => {
    const ctrl = controllerRef.current!;
    let raf = 0;
    let last = performance.now() / 1000;
    let orb: { x: number; y: number; s: number } | null = null;
    const vel = { x: 0, y: 0, s: 0 };
    const loop = () => {
      const t = performance.now() / 1000;
      const dt = Math.min(t - last, 0.033);
      last = t;
      ctrl.tick(dt);

      const { x, y, s, o } = ctrl.transform;
      if (stageRef.current) {
        stageRef.current.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
        stageRef.current.style.opacity = o.toFixed(3); // the page fades; the orb lives in its own layer and never does
      }

      const el = slotEls.current.get(shownRef.current);
      if (el && orbLayerRef.current) {
        const r = el.getBoundingClientRect();
        const target = { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / ORB_BASE };
        if (!orb) {
          orb = { ...target };
        } else {
          spring(orb, vel, target, dt);
        }
        // Slime stretch: the orb elongates along its direction of travel and narrows across it (area kept).
        const speed = Math.hypot(vel.x, vel.y);
        const stretch = Math.min(STRETCH_MAX, speed * STRETCH_PER_PX_S);
        const angle = Math.atan2(vel.y, vel.x) * (180 / Math.PI);
        orbLayerRef.current.style.transform =
          `translate(${(orb.x - ORB_BASE / 2).toFixed(2)}px, ${(orb.y - ORB_BASE / 2).toFixed(2)}px) ` +
          `scale(${orb.s.toFixed(4)}) rotate(${angle.toFixed(2)}deg) scale(${(1 + stretch).toFixed(4)}, ${(1 - stretch * 0.5).toFixed(4)}) rotate(${(-angle).toFixed(2)}deg)`;
      }

      const nextState = ctrl.orb;
      setOrbState((prev) => (prev === nextState ? prev : nextState));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const info = slots[shown];
  const liveState: OrbState = orbState ?? info?.state ?? 'idle';
  const shownLocation = { pathname: shown, search: '', hash: '', state: null, key: shown };

  return (
    <SlotContext.Provider value={{ register, update, unregister }}>
      <OrbTransitionContext.Provider value={orbState}>
        <div className="route-shell">
          <div ref={stageRef} className="route-stage">
            <Routes location={shownLocation}>{children}</Routes>
          </div>
        </div>
        <div ref={orbLayerRef} className="orb-layer" aria-hidden={false}>
          <TyTalkOrb state={liveState} form={info?.form ?? 'orb'} size={ORB_BASE} expressiveness={info?.expressiveness ?? 0.5} aria-label="Orb" />
        </div>
      </OrbTransitionContext.Provider>
    </SlotContext.Provider>
  );
}

function spring(p: { x: number; y: number; s: number }, v: { x: number; y: number; s: number }, target: { x: number; y: number; s: number }, dt: number) {
  for (const k of ['x', 'y', 's'] as const) {
    const accel = ORB_SPRING.omega * ORB_SPRING.omega * (target[k] - p[k]) - 2 * ORB_SPRING.zeta * ORB_SPRING.omega * v[k];
    v[k] += accel * dt;
    p[k] += v[k] * dt;
  }
}
