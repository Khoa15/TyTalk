import { useEffect, useState } from 'react';

import { INTRO_TEXT, INTRO_WORDS, revealCounts, wordStarts, type IntroClip } from '../lib/landingIntro';

/**
 * Plays each word clip at its scheduled time and types the word in step with it.
 * One clock drives both, so the text and the voice cannot drift apart.
 * If the browser blocks audio, the text still types on the same schedule.
 */
export function IntroTyping({ clips }: { clips: IntroClip[] }) {
  const [counts, setCounts] = useState<number[]>(() => INTRO_WORDS.map(() => 0));
  useEffect(() => {
    const durations = clips.map((c) => c.duration_ms);
    const starts = wordStarts(durations);
    const t0 = performance.now();
    const played = clips.map(() => false);
    let raf = 0;

    const tick = () => {
      const elapsed = performance.now() - t0;
      clips.forEach((clip, i) => {
        if (!played[i] && elapsed >= starts[i]) {
          played[i] = true;
          void clip.audio.play().catch(() => undefined);
        }
      });
      setCounts(revealCounts(elapsed, starts, durations, INTRO_WORDS));
      if (elapsed < starts[starts.length - 1] + durations[durations.length - 1]) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [clips]);

  return (
    <h1 aria-label={INTRO_TEXT}>
      {INTRO_WORDS.map((word, i) => (
        <span key={word} aria-hidden="true" className="intro-word">
          {word.slice(0, counts[i])}
          {i < INTRO_WORDS.length - 1 && counts[i] >= word.length ? ' ' : ''}
        </span>
      ))}
    </h1>
  );
}
