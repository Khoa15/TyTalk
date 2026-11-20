import type { OrbState } from '../components/orb/TyTalkOrb';

export interface SegmentEvt { index: number; state: OrbState; at_ms: number; duration_ms: number }
export interface ImageEvt { url: string; caption: string; char_offset: number; at_ms: number; duration_ms: number }
export interface AudioEvt { at_ms: number; duration_ms: number; char_offset: number; wav_base64: string }

export interface PlayerHandlers {
  onState: (state: OrbState) => void;
  onImage: (image: ImageEvt | null) => void;
  onAudio?: (audio: AudioEvt) => void;
  onEnd: () => void;
}

/**
 * Plays states, images and speech from ONE clock. The clock starts at `start()`.
 * Every event is due at `at_ms` relative to that start. `tick(now)` keeps it testable.
 */
export class TimelinePlayer {
  private segments: SegmentEvt[] = [];
  private images: ImageEvt[] = [];
  private audios: AudioEvt[] = [];
  private nextAudio = 0;
  private t0: number | null = null;
  private totalMs: number | null = null;
  private currentState: OrbState | null = null;
  private currentImage: ImageEvt | null = null;
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
