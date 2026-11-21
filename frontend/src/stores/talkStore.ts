import { create } from 'zustand';

import type { OrbState } from '../components/orb/TyTalkOrb';
import { playWavBase64 } from '../lib/audio';
import { createSpeechRecognizer, type SpeechRecognizer } from '../lib/speech';
import {
  TimelinePlayer,
  type AudioEvt,
  type EntityEvt,
  type FormEvt,
  type ImageEvt,
  type SegmentEvt,
} from '../lib/timelinePlayer';
import type { OrbForm, SimEvt } from '../lib/space/types';
import { ApiError } from '../services/apiClient';
import type { SseFrame } from '../services/sse';
import { streamTalk, type RecentMessage } from '../services/talkApi';
import { useAuthStore } from './authStore';

const HISTORY_LIMIT = 6;

/** Visuals that the timeline turns off at the end of a reply. */
const SPACE_RESET = { orbForm: 'orb' as OrbForm, entities: [], sim: null };

/** One line in the chat log: what the user said (right) or what Orb says (left). */
export interface ChatLine {
  id: number;
  role: 'user' | 'orb';
  text: string;
  /** An illustration Orb shows in the chat (only fetched, allowlisted URLs reach here). */
  image?: { url: string; caption: string };
}

interface TalkState {
  history: RecentMessage[];
  reply: string;
  lines: ChatLine[];
  /** Live transcript while the microphone is listening. */
  interim: string;
  listening: boolean;
  orbState: OrbState;
  /** Orb body form (eyes stay the same). */
  orbForm: OrbForm;
  /** Entities on stage. `startedAt` is when they appeared, on the performance.now() clock. */
  entities: { evt: EntityEvt; startedAt: number }[];
  /** The simulation on stage, if any. */
  sim: { evt: SimEvt; startedAt: number } | null;
  image: ImageEvt | null;
  /** Tappable follow-up questions for the child, from the server's suggest event. */
  suggestions: string[];
  busy: boolean;
  error: string | null;
  speakEnabled: boolean;

  send: (text: string) => Promise<void>;
  toggleSpeak: () => void;
  startListening: () => void;
  stopListening: () => void;
}

let nextLineId = 1;
let recognizer: SpeechRecognizer | null = null;

/** Client-side memory only: the server keeps no conversation. */
export const useTalkStore = create<TalkState>()((set, get) => ({
  history: [],
  reply: '',
  lines: [],
  interim: '',
  listening: false,
  orbState: 'idle',
  orbForm: 'orb',
  entities: [],
  sim: null,
  image: null,
  suggestions: [],
  busy: false,
  error: null,
  speakEnabled: true,

  toggleSpeak: () => set({ speakEnabled: !get().speakEnabled }),

  startListening: () => {
    if (get().listening || get().busy) return;
    const rec = createSpeechRecognizer();
    if (!rec) {
      set({ error: 'This browser does not support voice input' });
      return;
    }
    let finalText = '';
    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const result = e.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      set({ interim: `${finalText}${interimText}`.trim() });
    };
    rec.onerror = (e) => {
      const msg = e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone permission not granted'
        : "I didn't catch that, please try again";
      set({ error: msg, listening: false, interim: '' });
    };
    rec.onend = () => {
      recognizer = null;
      const text = (finalText || get().interim).trim();
      set({ listening: false, interim: '' });
      if (text) void get().send(text);
    };
    recognizer = rec;
    set({ listening: true, interim: '', error: null });
    rec.start();
  },

  stopListening: () => {
    recognizer?.stop();
  },

  send: async (text) => {
    const message = text.trim();
    if (!message || get().busy) return;

    const token = await useAuthStore.getState().ensureToken();
    if (!token) {
      set({ error: 'Your session has expired' });
      return;
    }

    const recent = get().history.slice(-HISTORY_LIMIT);
    const orbLineId = nextLineId + 1;
    nextLineId += 2;
    set({
      busy: true,
      error: null,
      reply: '',
      orbState: 'working',
      image: null,
      suggestions: [],
      lines: [
        ...get().lines,
        { id: orbLineId - 1, role: 'user', text: message },
        { id: orbLineId, role: 'orb', text: '' },
      ],
    });

    let finished = false;
    let doneReceived = false;
    let replyText = '';
    const shownImages = new Set<string>();
    const player = new TimelinePlayer({
      onState: (orbState) => set({ orbState }),
      onImage: (image) => {
        set({ image });
        // Each illustration joins the chat once, at the moment Orb shows it.
        if (image && !shownImages.has(image.url)) {
          shownImages.add(image.url);
          const id = nextLineId;
          nextLineId += 1;
          set({
            lines: [...get().lines, { id, role: 'orb', text: '', image: { url: image.url, caption: image.caption } }],
          });
        }
      },
      onAudio: (clip: AudioEvt) => {
        if (get().speakEnabled) playWavBase64(clip.wav_base64);
      },
      onForm: (form) => set({ orbForm: form ?? 'orb' }),
      onEntities: (active) =>
        set({ entities: active.map((evt) => ({ evt, startedAt: performance.now() })) }),
      onSim: (sim) => set({ sim: sim ? { evt: sim, startedAt: performance.now() } : null }),
      onEnd: () => {
        finished = true;
        set({ busy: false, orbState: 'idle', image: null, ...SPACE_RESET });
      },
    });

    // One clock: anchor on the first timed event so network and server latency stay out of the schedule.
    const anchorOn = (atMs: unknown) => player.start(performance.now() - Number(atMs ?? 0));

    const loop = () => {
      if (finished) return;
      player.tick();
      requestAnimationFrame(loop);
    };

    const onFrame = (frame: SseFrame) => {
      const data = frame.data as Record<string, unknown>;
      switch (frame.event) {
        case 'segment':
          anchorOn(data.at_ms);
          player.addSegment(data as unknown as SegmentEvt);
          break;
        case 'image':
          anchorOn(data.at_ms);
          player.addImage(data as unknown as ImageEvt);
          break;
        case 'audio':
          anchorOn(data.at_ms);
          player.addAudio(data as unknown as AudioEvt);
          break;
        case 'form':
          anchorOn(data.at_ms);
          player.addForm(data as unknown as FormEvt);
          break;
        case 'entity':
          anchorOn(data.at_ms);
          player.addEntity(data as unknown as EntityEvt);
          break;
        case 'sim':
          anchorOn(data.at_ms);
          player.addSim(data as unknown as SimEvt);
          break;
        case 'text': {
          replyText += String(data.delta ?? '');
          set({
            reply: replyText,
            lines: get().lines.map((l) => (l.id === orbLineId ? { ...l, text: replyText } : l)),
          });
          break;
        }
        case 'suggest': {
          const items = Array.isArray(data.items) ? data.items.map(String).slice(0, 3) : [];
          set({ suggestions: items });
          break;
        }
        case 'done':
          doneReceived = true;
          player.start();
          player.finish(Number(data.total_ms ?? 0));
          break;
        case 'error':
          set({ error: 'Orb is busy right now, please try again shortly' });
          break;
        default:
          break;
      }
    };

    requestAnimationFrame(loop);
    try {
      await streamTalk(message, recent, token, onFrame);
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 429
        ? 'Too many requests, please slow down'
        : 'Could not send your message';
      set({ error: msg });
    } finally {
      // Only cut playback short when no `done` arrived (error or dropped stream).
      if (!doneReceived && !finished) {
        player.stop();
        finished = true;
        set({ busy: false, orbState: 'idle', image: null, ...SPACE_RESET });
      }
    }

    // Drop an empty Orb line when the request failed before any text arrived.
    set({
      lines: get().lines.filter((l) => !(l.id === orbLineId && l.text === '')),
      history: [
        ...get().history,
        { role: 'user', text: message } as RecentMessage,
        { role: 'assistant', text: replyText } as RecentMessage,
      ].slice(-HISTORY_LIMIT),
    });
  },
}));
