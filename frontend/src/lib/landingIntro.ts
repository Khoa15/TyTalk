/** Landing intro: the words are spoken one by one and typed in sync with their clips. */

export const INTRO_WORDS = ['Hi!', 'I am', 'TyTalk'] as const;
export const INTRO_TEXT = INTRO_WORDS.join(' ');

export interface IntroClip {
  text: string;
  duration_ms: number;
  audio: HTMLAudioElement;
}

/** Start time (ms) of each word, measured from the start of the intro. Words play back to back. */
export function wordStarts(durations: number[]): number[] {
  const starts: number[] = [];
  let at = 0;
  for (const d of durations) {
    starts.push(at);
    at += d;
  }
  return starts;
}

/** How many characters of each word should be visible at `elapsed` ms. Typing runs across the clip. */
export function revealCounts(elapsed: number, starts: number[], durations: number[], words: readonly string[]): number[] {
  return words.map((word, i) => {
    const progress = (elapsed - starts[i]) / durations[i];
    if (progress <= 0) return 0;
    if (progress >= 1) return word.length;
    return Math.floor(progress * word.length);
  });
}

/** Fetches the manifest and every clip, and resolves once all of them can play. Fails closed to a timeout. */
export async function loadIntroClips(baseUrl = '/landing-intro', timeoutMs = 8000): Promise<IntroClip[]> {
  const manifest = await fetch(`${baseUrl}/manifest.json`).then((r) => {
    if (!r.ok) throw new Error('intro manifest missing');
    return r.json() as Promise<{ words: { text: string; file: string; duration_ms: number }[] }>;
  });

  const clips = await Promise.all(
    manifest.words.map(
      (w) =>
        new Promise<IntroClip>((resolve, reject) => {
          const audio = new Audio(`${baseUrl}/${w.file}`);
          audio.preload = 'auto';
          const ok = () => resolve({ text: w.text, duration_ms: w.duration_ms, audio });
          audio.addEventListener('canplaythrough', ok, { once: true });
          audio.addEventListener('error', () => reject(new Error(`clip failed: ${w.file}`)), { once: true });
          audio.load();
        }),
    ),
  );

  return withTimeout(Promise.resolve(clips), timeoutMs);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('intro load timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
