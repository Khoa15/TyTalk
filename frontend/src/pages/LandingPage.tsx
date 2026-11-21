import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { IntroTyping } from '../components/IntroTyping';
import { OrbSlot } from '../components/OrbSlot';
import { INTRO_TEXT, loadIntroClips, type IntroClip } from '../lib/landingIntro';
import '../styles/landing.css';

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

const CTA_LABEL = 'Start a conversation';

const BENEFITS = [
  {
    title: 'Answers that follow the thread',
    body: 'Follow up questions build on the last answer, so a child can keep asking why without starting over.',
  },
  {
    title: 'Simple words for small ears',
    body: 'Replies are written for young children, not copied from a textbook, so the answer lands the first time.',
  },
];

const STEPS = [
  { title: 'Ask out loud or type', body: 'Press the Orb and ask a question about stars, space or anything in the library.' },
  { title: 'The Orb finds the answer', body: 'TyTalk searches its library for the passages that answer the question.' },
  { title: 'It replies in simple words', body: 'The answer comes back in short, clear sentences, and the next question picks up where this one ended.' },
];

const FAQS = [
  {
    q: 'Who is TyTalk for?',
    a: 'Young children, with a parent or teacher nearby. The answers are written for small listeners.',
  },
  {
    q: 'Where do the answers come from?',
    a: 'From a library of source PDFs loaded into TyTalk. It does not browse the open web to answer.',
  },
  {
    q: 'What if the library does not cover my question?',
    a: '{{fallback behaviour: confirm with the product team before launch}}',
  },
  {
    q: 'Which languages does it speak?',
    a: 'English only for now.',
  },
  {
    q: 'Does it cost anything?',
    a: '{{pricing and free plan details}}',
  },
  {
    q: 'How is my child’s data handled?',
    a: '{{privacy summary and link to the privacy policy}}',
  },
];

const TAGLINE = 'Every big question deserves a patient answer in small words.';

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className={`lp-reveal ${shown ? 'lp-in' : ''} ${className}`.trim()}>
      {children}
    </section>
  );
}

/** Each word starts muted and lights up once as it crosses the trigger line, in reading order. */
function TaglineReveal() {
  const words = TAGLINE.split(' ');
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [lit, setLit] = useState<boolean[]>(() => words.map(() => false));

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setLit(words.map(() => true));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.i);
          setLit((prev) => {
            if (prev[i]) return prev;
            const next = [...prev];
            next[i] = true;
            return next;
          });
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -55% 0px' },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
    // words is derived from a constant, so it is stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <p className="lp-tagline" aria-label={TAGLINE}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-i={i}
            aria-hidden="true"
            className={`lp-word ${lit[i] ? 'lp-lit' : ''}`}
          >
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </p>
  );
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

  if (!played && clips === null) return <main className="landing landing-page" aria-busy="true" />;

  return (
    <main className="landing landing-page">
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <OrbSlot route="/" size={260} />
          {!played && clips && clips.length > 0 ? (
            <IntroTyping clips={clips} />
          ) : (
            <h1 className="lp-h1">{INTRO_TEXT}</h1>
          )}
          <p className="lp-sub">
            Ask about how stars are born, how the sun works, or anything in its library.
          </p>
          <div className="lp-cta">
            <Link className="button-primary" to="/talk">
              {CTA_LABEL} →
            </Link>
          </div>
        </div>
      </section>

      <Reveal className="lp-section">
        <h2 className="lp-section-head">Clear answers, from a library you can trust</h2>
        <div className="lp-grid">
          {BENEFITS.map((b) => (
            <article key={b.title} className="lp-card">
              <h3>{b.title}</h3>
              <p>{b.body}</p>
            </article>
          ))}
        </div>
      </Reveal>

      <Reveal className="lp-section">
        <TaglineReveal />
      </Reveal>

      <Reveal className="lp-section">
        <h2 className="lp-section-head">How it works</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="lp-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <strong>{s.title}</strong>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal className="lp-section">
        <h2 className="lp-section-head">What parents ask</h2>
        <figure className="lp-card" style={{ maxWidth: 680 }}>
          <p>{'{{testimonial}}'}</p>
          <figcaption style={{ fontSize: 14, lineHeight: '20px', color: 'var(--dim)' }}>{'{{parent name, role}}'}</figcaption>
        </figure>
      </Reveal>

      <Reveal className="lp-section">
        <h2 className="lp-section-head">Questions</h2>
        <div className="lp-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal className="lp-section">
        <div className="lp-cta">
          <Link to="/talk">{CTA_LABEL} →</Link>
          <p className="lp-risk">{'{{risk reversal: trial, cancellation or guarantee terms}}'}</p>
        </div>
      </Reveal>

      <footer className="lp-footer">
        <span>TyTalk</span>
      </footer>
    </main>
  );
}
