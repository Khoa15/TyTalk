import { useEffect, useRef, useState } from 'react';

import type { ChatLine } from '../stores/talkStore';

interface Props {
  lines: ChatLine[];
  busy: boolean;
  listening: boolean;
  interim: string;
}

type ImageLine = NonNullable<ChatLine['image']>;

/** Chat between the Orb (left) and the user (right). Scrolls to the newest line. */
export function ChatLog({ lines, busy, listening, interim }: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState<ImageLine | null>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, interim, listening]);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  return (
    <>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation with Orb">
        {lines.map((line) => (
          line.image ? (
            <figure key={line.id} className={`bubble bubble-${line.role} bubble-image`}>
              <button
                type="button"
                className="image-open"
                onClick={() => setZoomed(line.image ?? null)}
                aria-label={`View larger: ${line.image.caption || 'illustration'}`}
              >
                <img src={line.image.url} alt={line.image.caption} />
              </button>
              {line.image.caption && <figcaption>{line.image.caption}</figcaption>}
            </figure>
          ) : (
            <div key={line.id} className={`bubble bubble-${line.role}`}>
              {line.text || (busy && line.role === 'orb' ? <span className="typing">Orb is thinking…</span> : null)}
            </div>
          )
        ))}
        {listening && (
          <div className="bubble bubble-user bubble-live">{interim || 'Listening…'}</div>
        )}
      </div>

      {zoomed && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={zoomed.caption || 'Illustration'} onClick={() => setZoomed(null)}>
          <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
            <img src={zoomed.url} alt={zoomed.caption} />
            {zoomed.caption && <figcaption>{zoomed.caption}</figcaption>}
          </figure>
          <button type="button" className="lightbox-close" onClick={() => setZoomed(null)} aria-label="Close">
            ×
          </button>
        </div>
      )}
    </>
  );
}
