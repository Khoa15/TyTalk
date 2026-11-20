import { useState, type FormEvent } from 'react';

interface Props {
  disabled: boolean;
  listening: boolean;
  onSend: (text: string) => void;
  onToggleMic: () => void;
}

export function TalkInput({ disabled, listening, onSend, onToggleMic }: Props) {
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend(value);
    setValue('');
  };

  return (
    <form className="talk-input" onSubmit={submit}>
      <input
        aria-label="Message"
        placeholder="Say something to Orb…"
        maxLength={1000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        className={`mic-btn${listening ? ' is-listening' : ''}`}
        aria-pressed={listening}
        aria-label={listening ? 'Stop recording' : 'Speak to Orb with the microphone'}
        title={listening ? 'Stop recording' : 'Speak with the microphone'}
        onClick={onToggleMic}
        disabled={disabled && !listening}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <button type="submit" disabled={disabled || !value.trim()}>
        Send
      </button>
    </form>
  );
}
