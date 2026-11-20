import { API_BASE, ApiError } from './apiClient';
import { parseSse, type SseFrame } from './sse';

export interface RecentMessage {
  role: 'user' | 'assistant';
  text: string;
}

/** Streams one talk turn. Calls onFrame for each SSE event in order. */
export async function streamTalk(
  message: string,
  recent: RecentMessage[],
  token: string,
  onFrame: (frame: SseFrame) => void,
  signal?: AbortSignal,
): Promise<void> {
  const resp = await fetch(`${API_BASE}/talk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message, recent }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const data = await resp.json().catch(() => ({}));
    const retry = Number(resp.headers.get('Retry-After') ?? '') || undefined;
    throw new ApiError(resp.status, data?.error?.code ?? 'http_error', data?.error?.message ?? 'Failed to send message', retry);
  }
  for await (const frame of parseSse(resp.body)) onFrame(frame);
}
