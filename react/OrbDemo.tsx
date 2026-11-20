import { useState } from 'react';
import { ORB_META, ORB_STATES, TyTalkOrb, type OrbState } from './TyTalkOrb';

/** Minimal example: pick a state and watch the character. */
export function OrbDemo() {
  const [state, setState] = useState<OrbState>('idle');
  return (
    <div style={{ background: '#07070c', minHeight: '100vh', display: 'grid', placeItems: 'center', gap: 24, padding: 24 }}>
      <TyTalkOrb state={state} size={320} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 520 }}>
        {ORB_STATES.map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            aria-pressed={s === state}
            style={{
              padding: '8px 16px', borderRadius: 999, cursor: 'pointer', color: '#ecebf7',
              background: s === state ? ORB_META[s].glow + '33' : 'transparent',
              border: `1px solid ${s === state ? ORB_META[s].glow : '#25233a'}`,
            }}
          >
            {ORB_META[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}
