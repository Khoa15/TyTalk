/** Minimal typing for the Web Speech API (not in lib.dom for every TS version). */
export interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

export interface SpeechRecognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechCtor = new () => SpeechRecognizer;

/** Returns a recognizer for Vietnamese speech, or null when the browser has no Web Speech support. */
export function createSpeechRecognizer(lang = 'vi-VN'): SpeechRecognizer | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognizer = new Ctor();
  recognizer.lang = lang;
  recognizer.continuous = false;
  recognizer.interimResults = true;
  return recognizer;
}
