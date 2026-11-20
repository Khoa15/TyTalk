import { useEffect, useRef } from 'react';

import type { ChatLine } from '../stores/talkStore';

interface Props {
  lines: ChatLine[];
  busy: boolean;
  listening: boolean;
  interim: string;
}

/** Chat between the Orb (left) and the user (right). Scrolls to the newest line. */
export function ChatLog({ lines, busy, listening, interim }: Props) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, interim, listening]);

  const empty = lines.length === 0 && !listening;

  return (
    <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Hội thoại với Orb">
      {empty && <p className="chat-empty">Nói hoặc gõ để bắt đầu trò chuyện với Orb.</p>}
      {lines.map((line) => (
        line.image ? (
          <figure key={line.id} className={`bubble bubble-${line.role} bubble-image`}>
            <img src={line.image.url} alt={line.image.caption} />
            {line.image.caption && <figcaption>{line.image.caption}</figcaption>}
          </figure>
        ) : (
          <div key={line.id} className={`bubble bubble-${line.role}`}>
            {line.text || (busy && line.role === 'orb' ? <span className="typing">…</span> : null)}
          </div>
        )
      ))}
      {listening && (
        <div className="bubble bubble-user bubble-live">{interim || 'Đang nghe…'}</div>
      )}
    </div>
  );
}
