import type { OrbState } from '../components/orb/TyTalkOrb';

/**
 * Route transitions as a motion graph. Nodes are routes; each edge (from > to) has its own
 * exit motion, entry motion and the orb state the character shows while it plays.
 * Motion is spring-driven position and scale only: no opacity fades.
 */
export const ROUTES = ['/', '/signin', '/signup', '/talk'] as const;
export type Route = (typeof ROUTES)[number];

export interface Frame { x: number; y: number; s: number; o: number }
export interface Edge { out: Frame; in: Frame; orb: OrbState }

const EDGES: Record<string, Edge> = {
  // Form edges: the page fades out downwards and fades in from above. No horizontal slide.
  '/>/signin': { out: { x: 0, y: 40, s: 1, o: 0 }, in: { x: 0, y: -40, s: 1, o: 0 }, orb: 'cute' },
  '/>/signup': { out: { x: 0, y: 40, s: 1, o: 0 }, in: { x: 0, y: -40, s: 1, o: 0 }, orb: 'surprised' },
  '/signin>/signup': { out: { x: 0, y: 40, s: 1, o: 0 }, in: { x: 0, y: -40, s: 1, o: 0 }, orb: 'talking' },
  '/signup>/signin': { out: { x: 0, y: 40, s: 1, o: 0 }, in: { x: 0, y: -40, s: 1, o: 0 }, orb: 'talking' },
  '/signin>/talk': { out: { x: 0, y: 0, s: 0.9, o: 1 }, in: { x: 0, y: 60, s: 1.04, o: 1 }, orb: 'laugh' },
  '/signup>/talk': { out: { x: 0, y: 0, s: 0.9, o: 1 }, in: { x: 0, y: 60, s: 1.04, o: 1 }, orb: 'laugh' },
  '/talk>/': { out: { x: 0, y: 60, s: 0.95, o: 1 }, in: { x: 0, y: -40, s: 1, o: 1 }, orb: 'sleepy' },
};

const DEFAULT_EDGE: Edge = { out: { x: 0, y: 0, s: 0.96, o: 1 }, in: { x: 0, y: 24, s: 0.98, o: 1 }, orb: 'idle' };

export function edgeFor(from: Route, to: Route): Edge {
  return EDGES[`${from}>${to}`] ?? DEFAULT_EDGE;
}

export function normalizeRoute(pathname: string): Route {
  return (ROUTES as readonly string[]).includes(pathname) ? (pathname as Route) : '/';
}

const LEAVE = { omega: 18, zeta: 0.9 };
const ENTER = { omega: 14, zeta: 0.55 };
const KEYS: (keyof Frame)[] = ['x', 'y', 's', 'o'];
const ZERO: Frame = { x: 0, y: 0, s: 0, o: 0 };
const REST: Frame = { x: 0, y: 0, s: 1, o: 1 };

type Phase = 'idle' | 'leaving' | 'entering';

/**
 * Drives one transition: leaving (old page moves out) -> swap (route changes while hidden by motion)
 * -> entering (new page springs in). A new request mid-flight retargets from the current position.
 */
export class TransitionController {
  private pos: Frame = { ...REST };
  private vel: Frame = { ...ZERO };
  private target: Frame = { ...REST };
  private phase: Phase = 'idle';
  private edge: Edge | null = null;
  private to: Route | null = null;

  constructor(private readonly onSwap: (to: Route) => void) {}

  get currentPhase(): Phase {
    return this.phase;
  }

  get transform(): Frame {
    return this.pos;
  }

  /** Orb state of the edge that is playing, or null when no transition is running. */
  get orb(): OrbState | null {
    return this.edge ? this.edge.orb : null;
  }

  request(from: Route, to: Route): void {
    if (from === to && this.phase === 'idle') return;
    this.edge = edgeFor(from, to);
    this.to = to;
    this.phase = 'leaving';
    this.target = this.edge.out;
  }

  tick(dt: number): void {
    if (this.phase === 'idle' || !this.edge) return;
    const step = Math.min(dt, 0.033);

    if (this.phase === 'leaving') {
      spring(this.pos, this.vel, this.target, step, LEAVE);
      if (settled(this.pos, this.vel, this.target) && this.to) {
        const to = this.to;
        this.onSwap(to);
        this.phase = 'entering';
        this.pos = { ...this.edge.in };
        this.vel = { ...ZERO };
        this.target = { ...REST };
      }
      return;
    }

    spring(this.pos, this.vel, this.target, step, ENTER);
    if (settled(this.pos, this.vel, this.target)) {
      this.phase = 'idle';
      this.edge = null;
      this.to = null;
      this.pos = { ...REST };
      this.vel = { ...ZERO };
    }
  }
}

function spring(pos: Frame, vel: Frame, target: Frame, dt: number, cfg: { omega: number; zeta: number }) {
  for (const k of KEYS) {
    const accel = cfg.omega * cfg.omega * (target[k] - pos[k]) - 2 * cfg.zeta * cfg.omega * vel[k];
    vel[k] += accel * dt;
    pos[k] += vel[k] * dt;
  }
}

function settled(pos: Frame, vel: Frame, target: Frame): boolean {
  return KEYS.every((k) => Math.abs(pos[k] - target[k]) < 0.002 && Math.abs(vel[k]) < 0.05);
}
