import { parseSse } from '../src/services/sse';

function streamOf(chunks: Uint8Array[] | string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      controller.close();
    },
  });
}

describe('parseSse', () => {
  it('parses frames whose bytes are split across chunks', async () => {
    const out: { event: string; data: unknown }[] = [];
    for await (const f of parseSse(streamOf([
      'event: segment\ndata: {"state":"cu',
      'te","at_ms":0}\n\nevent: do',
      'ne\ndata: {"total_ms":2500}\n\n',
    ]))) out.push(f);
    expect(out).toEqual([
      { event: 'segment', data: { state: 'cute', at_ms: 0 } },
      { event: 'done', data: { total_ms: 2500 } },
    ]);
  });

  it('keeps multi-byte Vietnamese text intact when a chunk boundary splits a character', async () => {
    const bytes = new TextEncoder().encode('event: text\ndata: {"delta":"Chào bạn"}\n\n');
    const mid = Math.floor(bytes.length / 2);
    const frames: { data: unknown }[] = [];
    for await (const f of parseSse(streamOf([bytes.slice(0, mid), bytes.slice(mid)]))) frames.push(f);
    expect(frames[0].data).toEqual({ delta: 'Chào bạn' });
  });
});
