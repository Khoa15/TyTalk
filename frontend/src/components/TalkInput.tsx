import { useEffect, useState, type FormEvent } from 'react';

interface Props {
  disabled: boolean;
  listening: boolean;
  onSend: (text: string) => void;
  onToggleMic: () => void;
}

export function TalkInput({ disabled, listening, onSend, onToggleMic }: Props) {
  const [value, setValue] = useState('');
  // Enter while Orb is still answering: keep one message and send it when Orb is free.
  const [queued, setQueued] = useState<string | null>(null);

  useEffect(() => {
    if (!disabled && queued) {
      onSend(queued);
      setQueued(null);
    }
  }, [disabled, queued, onSend]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (disabled) {
      setQueued(value);
      setValue('');
      return;
    }
    onSend(value);
    setValue('');
  };

  return (
    <form className="talk-input" onSubmit={submit}>
      <input
        aria-label="Message"
        placeholder={queued ? `Orb will hear "${queued}" next…` : 'Say something to Orb…'}
        maxLength={1000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
      <button type="submit" disabled={!value.trim()}>
        Send
      </button>
    </form>
  );
}
