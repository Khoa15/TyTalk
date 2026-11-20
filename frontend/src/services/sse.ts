export interface SseFrame {
  event: string;
  data: unknown;
}

/** Parses an SSE byte stream into frames. Chunk boundaries may fall anywhere. */
export async function* parseSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf('\n\n');
    while (sep !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const frame = toFrame(raw);
      if (frame) yield frame;
      sep = buffer.indexOf('\n\n');
    }
  }
  buffer += decoder.decode();
  const tail = toFrame(buffer.trim());
  if (tail) yield tail;
}

function toFrame(raw: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: JSON.parse(dataLines.join('\n')) };
}
