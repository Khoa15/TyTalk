import type { OrbState } from '../components/orb/TyTalkOrb';
import type { OrbForm } from './space/types';
import type { EntityKind, SimEvt, SimId } from './space/types';

export interface SegmentEvt { index: number; state: OrbState; at_ms: number; duration_ms: number }
export interface ImageEvt { url: string; caption: string; char_offset: number; at_ms: number; duration_ms: number }
export interface AudioEvt { at_ms: number; duration_ms: number; char_offset: number; wav_base64: string }
export interface FormEvt { form: OrbForm; at_ms: number; duration_ms: number }
export interface EntityEvt { kind: EntityKind; count: number; at_ms: number; duration_ms: number }
export type { SimEvt };

export interface PlayerHandlers {
  onState: (state: OrbState) => void;
  onImage: (image: ImageEvt | null) => void;
  onAudio?: (audio: AudioEvt) => void;
  /** Orb body form changes (null = back to the plain orb). */
  onForm?: (form: OrbForm | null) => void;
  /** The set of entities on stage changed. Called on start and end only, never per frame. */
  onEntities?: (active: EntityEvt[]) => void;
  /** The simulation on stage changed (null = none). */
  onSim?: (sim: SimEvt | null) => void;
  onEnd: () => void;
}

/**
 * Plays states, images, forms, entities, simulations and speech from ONE clock. The clock starts at `start()`.
 * Every event is due at `at_ms` relative to that start. `tick(now)` keeps it testable.
 */
export class TimelinePlayer {
  private segments: SegmentEvt[] = [];
  private images: ImageEvt[] = [];
  private audios: AudioEvt[] = [];
  private forms: FormEvt[] = [];
  private entities: EntityEvt[] = [];
  private sims: SimEvt[] = [];
  private nextAudio = 0;
  private t0: number | null = null;
  private totalMs: number | null = null;
  private currentState: OrbState | null = null;
  private currentImage: ImageEvt | null = null;
  private currentForm: OrbForm | null = null;
  private currentEntities: EntityEvt[] = [];
  private currentSim: SimEvt | null = null;
  private ended = false;
  /** Largest gap between a scheduled state change and the tick that applied it (budget: 50 ms). */
  maxDriftMs = 0;

  constructor(
    private readonly handlers: PlayerHandlers,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  /**
   * Start the clock. Pass `anchor` to place t0 in the past: the first event's arrival minus its at_ms.
   * Anchoring on arrival keeps network and server latency out of the schedule.
   */
  start(anchor?: number): void {
    if (this.t0 === null) this.t0 = anchor ?? this.clock();
  }

  isStarted(): boolean {
    return this.t0 !== null;
  }

  addSegment(seg: SegmentEvt): void {
    this.segments.push(seg);
  }

  addImage(img: ImageEvt): void {
    this.images.push(img);
  }

  /** Audio clips are added in playback order (the server advances its cursor per clip). */
  addAudio(audio: AudioEvt): void {
    this.audios.push(audio);
  }

  addForm(form: FormEvt): void {
    this.forms.push(form);
  }

  addEntity(entity: EntityEvt): void {
    this.entities.push(entity);
  }

  addSim(sim: SimEvt): void {
    this.sims.push(sim);
  }

  /** Called when the server's `done` event arrives. Playback ends once elapsed passes total. */
  finish(totalMs: number): void {
    this.totalMs = totalMs;
  }

  /** Advance playback to `now` (ms, same clock as start). Idempotent for the same `now`. */
  tick(now: number = this.clock()): void {
    if (this.t0 === null || this.ended) return;
    const elapsed = now - this.t0;

    const seg = this.segments.find((s) => elapsed >= s.at_ms && elapsed < s.at_ms + s.duration_ms);
    const nextState: OrbState | null = seg ? seg.state : null;
    if (nextState !== this.currentState) {
      this.currentState = nextState;
      if (seg) this.trackDrift(elapsed, seg.at_ms);
      if (nextState) this.handlers.onState(nextState);
    }

    const img = this.images.find((i) => elapsed >= i.at_ms && elapsed < i.at_ms + i.duration_ms) ?? null;
    if (img !== this.currentImage) {
      this.currentImage = img;
      this.handlers.onImage(img);
    }

    const form = this.forms.find((f) => elapsed >= f.at_ms && elapsed < f.at_ms + f.duration_ms) ?? null;
    const nextForm = form ? form.form : null;
    if (nextForm !== this.currentForm) {
      this.currentForm = nextForm;
      this.handlers.onForm?.(nextForm);
    }

    const active = this.entities.filter((e) => elapsed >= e.at_ms && elapsed < e.at_ms + e.duration_ms);
    if (!sameEntities(active, this.currentEntities)) {
      this.currentEntities = active;
      this.handlers.onEntities?.(active);
    }

    const sim = this.sims.find((s) => elapsed >= s.at_ms && elapsed < s.at_ms + s.duration_ms) ?? null;
    if (sim !== this.currentSim) {
      this.currentSim = sim;
      this.handlers.onSim?.(sim);
    }

    while (this.nextAudio < this.audios.length && elapsed >= this.audios[this.nextAudio].at_ms) {
      const clip = this.audios[this.nextAudio];
      this.nextAudio += 1;
      this.trackDrift(elapsed, clip.at_ms);
      this.handlers.onAudio?.(clip);
    }

    if (this.totalMs !== null && elapsed >= this.totalMs) {
      this.ended = true;
      this.handlers.onState('idle');
      if (this.currentImage) {
        this.currentImage = null;
        this.handlers.onImage(null);
      }
      if (this.currentForm) {
        this.currentForm = null;
        this.handlers.onForm?.(null);
      }
      if (this.currentEntities.length) {
        this.currentEntities = [];
        this.handlers.onEntities?.([]);
      }
      if (this.currentSim) {
        this.currentSim = null;
        this.handlers.onSim?.(null);
      }
      this.handlers.onEnd();
    }
  }

  stop(): void {
    this.ended = true;
  }

  private trackDrift(elapsed: number, dueAt: number): void {
    const drift = elapsed - dueAt;
    if (drift > this.maxDriftMs) this.maxDriftMs = drift;
  }
}

function sameEntities(a: EntityEvt[], b: EntityEvt[]): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i]);
}
