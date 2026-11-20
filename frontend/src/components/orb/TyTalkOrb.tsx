import { useEffect, useId, useRef, type CSSProperties } from 'react';
import './TyTalkOrb.css';

export type OrbState =
  | 'idle' | 'talking' | 'working' | 'cute'
  | 'surprised' | 'sleepy' | 'angry' | 'laugh' | 'dizzy';

export const ORB_STATES: readonly OrbState[] = [
  'idle', 'talking', 'working', 'cute', 'surprised', 'sleepy', 'angry', 'laugh', 'dizzy',
];

type EyeKind = 'pill' | 'arcUp' | 'arcDown' | 'angry' | 'laugh' | 'dizzy';

export const ORB_META: Record<OrbState, { glow: string; glow2: string; eyes: EyeKind; label: string }> = {
  idle:      { glow: '#8a5cff', glow2: '#c0389a', eyes: 'pill',    label: 'Idle' },
  talking:   { glow: '#6a7cff', glow2: '#9b4dff', eyes: 'pill',    label: 'Talking' },
  working:   { glow: '#2ee6ff', glow2: '#4a6bff', eyes: 'pill',    label: 'Working' },
  cute:      { glow: '#ff8fd8', glow2: '#9d7bff', eyes: 'arcUp',   label: 'Cute' },
  surprised: { glow: '#9be7ff', glow2: '#7a8cff', eyes: 'pill',    label: 'Surprised' },
  sleepy:    { glow: '#5a63c9', glow2: '#35307a', eyes: 'arcDown', label: 'Sleepy' },
  angry:     { glow: '#ff5a4d', glow2: '#ff9a3c', eyes: 'angry',   label: 'Angry' },
  laugh:     { glow: '#ffc24d', glow2: '#ff6fa8', eyes: 'laugh',   label: 'Laugh' },
  dizzy:     { glow: '#a6e04d', glow2: '#3ccf9a', eyes: 'dizzy',   label: 'Dizzy' },
};

export interface TyTalkOrbFrame { scale: number; x: number; y: number; tilt: number; glow: number }

export interface TyTalkOrbProps {
  state?: OrbState;
  /** CSS width of the character. Height follows. */
  size?: number | string;
  /** 0..1 speech level (e.g. from an audio analyser). Only used while state is "talking"; if omitted a speech rhythm is simulated. */
  level?: number;
  /** 0..1 how much the idle character shows personality (glances, bounces, tilts). Driven by user traits. */
  expressiveness?: number;
  /** Called every animation frame with the motion values, handy for debugging graphs. */
  onFrame?: (frame: TyTalkOrbFrame) => void;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
}

const PI = Math.PI;

// ---- Motion graph -------------------------------------------------------
// Every state is a target pose. The body follows its target with a damped spring, so every
// transition is physical motion (overshoot, settle) instead of an opacity fade.
// Entering a state adds a kick to the pose (anticipation / pop), and a few edges have their own kick.
const SPRING_OMEGA = 14; // rad/s: how fast the body follows its target
const SPRING_ZETA = 0.5; // < 1 gives overshoot
const FACE_OMEGA = 22;   // squash-and-stretch spring for the eye face
const FACE_ZETA = 0.35;  // low damping: the face springs back past 1 (stretch)
const FACE_SQUASH = 0.2; // face height right after a state change

interface Pose { sc: number; x: number; y: number; tilt: number; glow: number; eyeY: number; look: number; fx: number; fy: number }
type PoseKey = keyof Pose;
const POSE_KEYS: PoseKey[] = ['sc', 'x', 'y', 'tilt', 'glow', 'eyeY', 'look', 'fx', 'fy'];
const REST: Pose = { sc: 1, x: 0, y: 0, tilt: 0, glow: 0.55, eyeY: 1, look: 0, fx: 0, fy: 0 };

/** Kick added to the pose when a state is entered (displacement, in pose units). */
const ENTRY_KICK: Partial<Record<OrbState, Partial<Pose>>> = {
  surprised: { sc: 0.12, y: -18 },
  angry: { x: 10, sc: 0.04 },
  laugh: { fy: -9, sc: 0.03 },
  cute: { sc: 0.05, y: -4 },
  dizzy: { tilt: 14 },
  sleepy: { y: 9, sc: -0.03 },
  idle: { y: -6 },
  talking: { sc: 0.04 },
  working: { look: 9 },
};

/** Edge-specific kicks: the transition from one state to another has its own motion. */
const EDGE_KICK: Record<string, Partial<Pose>> = {
  'sleepy>idle': { y: -12, sc: 0.04 },   // wake up with a bounce
  'idle>angry': { x: 14, tilt: -6 },     // flinch, then shake
  'talking>idle': { sc: -0.03 },         // settle after speaking
};

export function springStep(pos: Pose, vel: Pose, target: Pose, dt: number, omega: number, zeta: number): void {
  for (const key of POSE_KEYS) {
    const accel = omega * omega * (target[key] - pos[key]) - 2 * zeta * omega * vel[key];
    vel[key] += accel * dt;
    pos[key] += vel[key] * dt;
  }
}

/** Target pose for a state at time t. `since` is seconds since the state was entered. */
export function targetPose(st: OrbState, t: number, since: number, level: number, k: number, e = 0.5): Pose {
  const P: Pose = { ...REST };
  switch (st) {
    case 'idle':
      P.sc = 1 + 0.018 * Math.sin(t * 1.6);
      P.y = 4 * Math.sin(t * 0.8);
      P.glow = 0.55 + 0.1 * Math.sin(t * 1.6) + 0.06 * e;
      P.tilt = 4 * e * Math.sin(t * 0.5);                       // curious head tilt
      P.look = e * (7 * Math.sin(t * 0.31) + 3 * Math.sin(t * 1.3)); // eyes glance around
      break;
    case 'talking':
      P.sc = 1 + 0.09 * level;
      P.glow = 0.5 + 0.45 * level;
      break;
    case 'working':
      P.sc = 1 + 0.012 * Math.sin(t * 5);
      P.y = 2 * Math.sin(t * 1.1);
      P.glow = 0.6 + 0.12 * Math.sin(t * 5);
      P.eyeY = 0.8;
      P.look = 12 * Math.sin(t * 1.1) + 4 * Math.sin(t * 3.3);
      break;
    case 'cute':
      P.sc = 1.02 + 0.012 * Math.sin(t * 1.6);
      P.y = 3 * Math.sin(t * 0.8);
      P.glow = 0.65 + 0.1 * Math.sin(t * 1.6);
      break;
    case 'surprised':
      P.sc = 1.04 + 0.01 * Math.sin(t * 1.6);
      P.glow = 0.7;
      P.eyeY = 1.2;
      break;
    case 'sleepy':
      P.sc = 1 + 0.04 * Math.sin(t * 0.9);
      P.y = 6 + 5 * Math.sin(t * 0.9);
      P.tilt = 3 * Math.sin(t * 0.45);
      P.glow = 0.3 + 0.1 * Math.sin(t * 0.9);
      break;
    case 'angry':
      P.sc = 1.02;
      P.x = 1.6 * Math.sin(t * 52) + 0.8 * Math.sin(t * 83);
      P.y = 0.8 * Math.sin(t * 61);
      P.glow = 0.65 + 0.2 * Math.sin(t * 8);
      break;
    case 'laugh': {
      const w = Math.sin(t * 9);
      P.fy = -10 * w;
      P.fx = 1.5 * Math.sin(t * 4.5);
      P.y = -2.5 * w;
      P.tilt = 2.5 * Math.sin(t * 4.5);
      P.sc = 1.02 + 0.015 * w;
      P.glow = 0.65 + 0.1 * w;
      break;
    }
    case 'dizzy':
      P.tilt = 12 * Math.sin(t * 2.4);
      P.x = 6 * Math.sin(t * 2.4 + 1.5);
      P.y = 4 * Math.cos(t * 2.4);
      P.glow = 0.5 + 0.1 * Math.sin(t * 2.4);
      break;
  }
  void since;
  P.sc = 1 + (P.sc - 1) * k;
  P.x *= k; P.y *= k; P.tilt *= k; P.fx *= k; P.fy *= k;
  return P;
}

export function TyTalkOrb({
  state = 'idle', size = 280, level, expressiveness = 0.5, onFrame, className, style, 'aria-label': ariaLabel,
}: TyTalkOrbProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (n: string) => `${uid}-${n}`;
  const ref = (n: string) => `url(#${id(n)})`;

  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const orbitRef = useRef<SVGGElement>(null);
  const pillRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);

  const stateRef = useRef<OrbState>(state);
  const levelRef = useRef<number | undefined>(level);
  const expressRef = useRef(expressiveness);
  const frameRef = useRef(onFrame);
  levelRef.current = level;
  expressRef.current = expressiveness;
  frameRef.current = onFrame;
  stateRef.current = state;

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const k = reduce ? 0.3 : 1;
    const svg = svgRef.current;
    if (!svg) return;

    let raf = 0;
    let last = performance.now() / 1000;
    let env = 0, target = 0, nextSyl = 0, nextBlink = last + 2.5, nextBounce = last + 4, orbitA = 0;
    let shown: OrbState = stateRef.current;
    let enteredAt = last;
    const pos: Pose = { ...REST };
    const vel: Pose = { sc: 0, x: 0, y: 0, tilt: 0, glow: 0, eyeY: 0, look: 0, fx: 0, fy: 0 };
    let faceSy = 1, faceVy = 0;

    const applyShown = (st: OrbState) => {
      svg.setAttribute('data-state', st);
      svg.setAttribute('data-eyes', ORB_META[st].eyes);
      svg.style.setProperty('--orb-glow', ORB_META[st].glow);
      svg.style.setProperty('--orb-glow2', ORB_META[st].glow2);
    };
    const kick = (from: OrbState, to: OrbState) => {
      const edge = EDGE_KICK[`${from}>${to}`] ?? ENTRY_KICK[to] ?? {};
      for (const key of POSE_KEYS) if (edge[key] !== undefined) pos[key] += (edge[key] as number) * k;
    };
    applyShown(shown);

    const loop = () => {
      const t = performance.now() / 1000;
      const dt = Math.min(0.033, t - last);
      last = t;
      const want = stateRef.current;
      const e = expressRef.current;

      // State changes take effect immediately: the eyes swap while the face is squashed,
      // so the swap itself is hidden by motion, not by a fade.
      if (want !== shown) {
        const from = shown;
        shown = want;
        enteredAt = t;
        applyShown(shown);
        kick(from, shown);
        faceSy = FACE_SQUASH;
        faceVy = 0;
        if (ORB_META[shown].eyes !== 'pill') nextBlink = Math.max(nextBlink, t + 1);
      }

      // Idle personality: a small random bounce now and then.
      if (shown === 'idle' && t > nextBounce) {
        pos.y += -10 * e * k;
        pos.sc += 0.03 * e * k;
        nextBounce = t + 4 + Math.random() * 5;
      }

      if (shown === 'talking') {
        const external = levelRef.current;
        if (external !== undefined) {
          target = Math.max(0, Math.min(1, external));
        } else if (t > nextSyl) {
          target = Math.random() < 0.2 ? 0.05 : 0.35 + 0.65 * Math.random();
          nextSyl = t + 0.08 + 0.12 * Math.random();
        }
        env += (target - env) * Math.min(1, dt * 14);
      }

      springStep(pos, vel, targetPose(shown, t, t - enteredAt, env, k, e), dt, SPRING_OMEGA, SPRING_ZETA);

      // Squash and stretch of the face (eye band).
      const faceTarget = 1;
      faceVy += (FACE_OMEGA * FACE_OMEGA * (faceTarget - faceSy) - 2 * FACE_ZETA * FACE_OMEGA * faceVy) * dt;
      faceSy += faceVy * dt;

      // blink only on the pill eyes
      let blink = 1;
      if (ORB_META[shown].eyes === 'pill' && t > nextBlink) {
        const p = (t - nextBlink) / 0.14;
        if (p < 1) blink = 1 - Math.sin(PI * p) * 0.92;
        else nextBlink = t + 2.5 + Math.random() * 2.5;
      }
      orbitA += dt * 400;

      bodyRef.current?.setAttribute(
        'transform',
        `translate(${(200 + pos.x).toFixed(2)} ${(200 + pos.y).toFixed(2)}) rotate(${pos.tilt.toFixed(2)}) scale(${pos.sc.toFixed(4)}) translate(-200 -200)`,
      );
      faceRef.current?.setAttribute(
        'transform',
        `translate(${pos.fx.toFixed(2)} ${(200 + pos.fy).toFixed(2)}) scale(1 ${faceSy.toFixed(3)}) translate(0 -200)`,
      );
      glowRef.current?.setAttribute('opacity', pos.glow.toFixed(3));
      if (pillRef.current) pillRef.current.style.transform = `translate(${pos.look.toFixed(2)}px,0) scale(1,${(blink * pos.eyeY).toFixed(3)})`;
      orbitRef.current?.setAttribute('transform', `rotate(${(orbitA % 360).toFixed(1)} 200 200)`);
      frameRef.current?.({ scale: pos.sc, x: pos.x, y: pos.y, tilt: pos.tilt, glow: pos.glow });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const meta = ORB_META[state];
  const svgStyle = {
    width: size, height: 'auto', aspectRatio: '1 / 1',
    '--orb-glow': meta.glow, '--orb-glow2': meta.glow2,
    ...style,
  } as CSSProperties;

  return (
    <svg
      ref={svgRef}
      className={`tyorb${className ? ' ' + className : ''}`}
      viewBox="0 0 400 400"
      style={svgStyle}
      role="img"
      aria-label={ariaLabel ?? `TyTalk orb, ${meta.label}`}
    >
      <defs>
        <radialGradient id={id('bodyG')} cx="42%" cy="34%" r="75%">
          <stop offset="0" stopColor="#2b2745" /><stop offset=".55" stopColor="#14111f" /><stop offset="1" stopColor="#07060d" />
        </radialGradient>
        <linearGradient id={id('rimG')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1ecff" stopOpacity=".95" /><stop offset=".45" stopColor="#b9a8ff" stopOpacity=".35" /><stop offset="1" stopColor="#7fe9ff" stopOpacity=".8" />
        </linearGradient>
        <radialGradient id={id('tintG')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity=".9" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        {/* Soft glow as a gradient: a blur filter re-rendered every frame and dropped the animation to ~30 fps. */}
        <radialGradient id={id('glowG')} cx="50%" cy="50%" r="50%">
          <stop offset="0" style={{ stopColor: 'var(--orb-glow)' }} stopOpacity="1" />
          <stop offset=".6" style={{ stopColor: 'var(--orb-glow)' }} stopOpacity=".55" />
          <stop offset="1" style={{ stopColor: 'var(--orb-glow)' }} stopOpacity="0" />
        </radialGradient>
        <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        <clipPath id={id('clip')}><circle cx="200" cy="200" r="88" /></clipPath>
        <mask id={id('mask')}>
          <rect width="400" height="400" fill="#000" />
          <circle cx="170" cy="262" r="70" fill={ref('tintG')} />
        </mask>
      </defs>

      <g fill="#9fb4ff">
        <circle className="tyorb-star" cx="62" cy="96" r="1.6" />
        <circle className="tyorb-star" cx="338" cy="120" r="1.8" style={{ animationDelay: '-1s' }} />
        <circle className="tyorb-star" cx="88" cy="300" r="1.4" style={{ animationDelay: '-2s' }} />
        <circle className="tyorb-star" cx="318" cy="292" r="1.6" style={{ animationDelay: '-.6s' }} />
        <circle className="tyorb-star" cx="250" cy="52" r="1.2" style={{ animationDelay: '-1.8s' }} />
        <circle className="tyorb-star" cx="140" cy="346" r="1.2" style={{ animationDelay: '-2.6s' }} />
      </g>

      <g ref={bodyRef}>
        <circle ref={glowRef} cx="200" cy="204" r="104" fill={ref('glowG')} opacity=".55" />

        <g className="tyorb-layer tyorb-orbit">
          <g ref={orbitRef}>
            <circle className="tyorb-orbit-arc" cx="200" cy="200" r="112" strokeDasharray="70 633" />
            <circle className="tyorb-orbit-arc" cx="200" cy="200" r="112" strokeWidth="1" strokeOpacity=".35" strokeDasharray="3 9" />
          </g>
        </g>

        <circle cx="200" cy="200" r="88" fill={ref('bodyG')} />
        <g clipPath={ref('clip')}><rect className="tyorb-tint" width="400" height="400" mask={ref('mask')} opacity=".75" /></g>
        <circle cx="200" cy="200" r="86" fill="none" stroke={ref('rimG')} strokeWidth="4" opacity=".9" />
        <ellipse cx="166" cy="150" rx="22" ry="10" fill="#fff" opacity=".16" transform="rotate(-35 166 150)" filter={ref('soft')} />

        {/* ---------- eyes: no mouth on this character ---------- */}
        <g ref={faceRef}>
          <g className="tyorb-layer tyorb-cheek"><g filter={ref('soft')} opacity=".7"><ellipse cx="158" cy="218" rx="12" ry="7" /><ellipse cx="242" cy="218" rx="12" ry="7" /></g></g>

          {/* pill: idle / talking / working / surprised */}
          <g ref={pillRef} className="tyorb-layer tyorb-pill tyorb-pillbox">
            <rect className="tyorb-eye" x="178" y="182" width="13" height="28" rx="6.5" />
            <rect className="tyorb-eye" x="209" y="182" width="13" height="28" rx="6.5" />
          </g>
          <g className="tyorb-layer tyorb-brows">
            <path className="tyorb-stroke" strokeWidth="3.5" d="M175 171 Q184.5 163 194 171" />
            <path className="tyorb-stroke" strokeWidth="3.5" d="M206 171 Q215.5 163 225 171" />
          </g>

          {/* cute: ^ ^ */}
          <g className="tyorb-layer tyorb-arcUp">
            <path className="tyorb-stroke" strokeWidth="12" d="M175 204 Q184.5 190 194 204" />
            <path className="tyorb-stroke" strokeWidth="12" d="M206 204 Q215.5 190 225 204" />
          </g>
          {/* sleepy: low curves */}
          <g className="tyorb-layer tyorb-arcDown">
            <path className="tyorb-stroke" strokeWidth="7" d="M174 198 Q184 211 194 198" />
            <path className="tyorb-stroke" strokeWidth="7" d="M206 198 Q216 211 226 198" />
          </g>
          {/* angry: slanted brows over squared eyes */}
          <g className="tyorb-layer tyorb-angry">
            <path className="tyorb-stroke" strokeWidth="5" d="M172 184 L196 193" />
            <path className="tyorb-stroke" strokeWidth="5" d="M228 184 L204 193" />
            <rect className="tyorb-eye" x="178" y="198" width="16" height="13" rx="3" />
            <rect className="tyorb-eye" x="206" y="198" width="16" height="13" rx="3" />
          </g>
          {/* laugh: > < */}
          <g className="tyorb-layer tyorb-laugh">
            <path className="tyorb-stroke" strokeWidth="8" d="M174 188 L194 200 L174 212" />
            <path className="tyorb-stroke" strokeWidth="8" d="M226 188 L206 200 L226 212" />
          </g>
          {/* dizzy: x x */}
          <g className="tyorb-layer tyorb-dizzy">
            <path className="tyorb-stroke" strokeWidth="7" d="M175 191 L193 209 M193 191 L175 209" />
            <path className="tyorb-stroke" strokeWidth="7" d="M207 191 L225 209 M225 191 L207 209" />
          </g>
        </g>
      </g>

      <g className="tyorb-layer tyorb-spark" fill="#ffd9f3">
        <path className="tyorb-spark-item" d="M96 140 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" />
        <path className="tyorb-spark-item" style={{ animationDelay: '-.5s' }} d="M308 172 l2.5 7 7 2.5 -7 2.5 -2.5 7 -2.5 -7 -7 -2.5 7 -2.5z" />
        <path className="tyorb-spark-item" style={{ animationDelay: '-1s' }} d="M286 96 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
        <path className="tyorb-spark-item" style={{ animationDelay: '-.2s' }} d="M112 270 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
      </g>
      <g className="tyorb-layer tyorb-zzz">
        <text className="tyorb-z" x="262" y="140">z</text>
        <text className="tyorb-z" x="262" y="140">z</text>
        <text className="tyorb-z" x="262" y="140">Z</text>
      </g>
    </svg>
  );
}

export default TyTalkOrb;
