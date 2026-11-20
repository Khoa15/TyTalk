import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { IntroTyping } from '../components/IntroTyping';
import { OrbSlot } from '../components/OrbSlot';
import { INTRO_TEXT, loadIntroClips, type IntroClip } from '../lib/landingIntro';

/**
 * The intro is spoken once per browser tab session. sessionStorage survives refresh and in-app
 * returns to this page, and is cleared when the tab closes, so a new visit speaks again.
 */
const INTRO_PLAYED_KEY = 'tytalk-intro-played';

function introAlreadyPlayed(): boolean {
  try {
    return sessionStorage.getItem(INTRO_PLAYED_KEY) === '1';
  } catch {
    return false; // storage blocked: fall back to playing the intro
  }
}

function markIntroPlayed(): void {
  try {
    sessionStorage.setItem(INTRO_PLAYED_KEY, '1');
  } catch {
    // storage blocked: nothing to record
  }
}

export function LandingPage() {
  const [played] = useState(introAlreadyPlayed);
  const [clips, setClips] = useState<IntroClip[] | null>(null);

  // Load the intro clips only when they will be played.
  useEffect(() => {
    if (played) return;
    let cancelled = false;
    loadIntroClips()
      .then((loaded) => !cancelled && setClips(loaded))
      .catch(() => !cancelled && setClips([]));
    return () => {
      cancelled = true;
    };
  }, [played]);

  // Record the intro as played as soon as it starts, so a refresh mid-intro does not repeat it.
  useEffect(() => {
    if (clips && clips.length > 0) markIntroPlayed();
  }, [clips]);

  if (!played && clips === null) return <main className="landing" aria-busy="true" />;

  return (
    <main className="landing">
      <div className="landing-hero">
        <OrbSlot route="/" size={260} />
        {!played && clips && clips.length > 0 ? (
          <IntroTyping clips={clips} />
        ) : (
          <h1>{INTRO_TEXT}</h1>
        )}
        <div className="cta">
          <Link className="button-primary" to="/talk">Get Started →</Link>
        </div>
      </div>
    </main>
  );
}
