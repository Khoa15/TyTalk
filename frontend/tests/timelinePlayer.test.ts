import { TimelinePlayer } from '../src/lib/timelinePlayer';

function fakeClock() {
  let now = 1000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('TimelinePlayer', () => {
  it('switches orb state and image on one clock, then ends at total_ms', () => {
    const clock = fakeClock();
    const states: string[] = [];
    const images: (string | null)[] = [];
    let ended = false;
    const player = new TimelinePlayer(
      {
        onState: (s) => states.push(s),
        onImage: (i) => images.push(i ? i.url : null),
        onEnd: () => (ended = true),
      },
      clock.now,
    );

    player.addSegment({ index: 0, state: 'cute', at_ms: 0, duration_ms: 1000 });
    player.addSegment({ index: 1, state: 'laugh', at_ms: 1000, duration_ms: 1000 });
    player.addImage({ url: 'https://upload.wikimedia.org/x.jpg', caption: 'x', char_offset: 0, at_ms: 500, duration_ms: 1000 });
    player.start();
    player.finish(2000);

    player.tick(); // elapsed 0
    clock.advance(600);
    player.tick(); // elapsed 600: cute + image
    clock.advance(600);
    player.tick(); // elapsed 1200: laugh, image still shown until 1500
    clock.advance(500);
    player.tick(); // elapsed 1700: image gone
    clock.advance(400);
    player.tick(); // elapsed 2100: ended

    expect(states).toEqual(['cute', 'laugh', 'idle']);
    expect(images).toEqual(['https://upload.wikimedia.org/x.jpg', null]);
    expect(ended).toBe(true);
  });

  it('keeps playback drift within the 50 ms budget when ticked at 60 fps', () => {
    const clock = fakeClock();
    const player = new TimelinePlayer({ onState: () => {}, onImage: () => {}, onEnd: () => {} }, clock.now);
    for (let i = 0; i < 6; i++) {
      player.addSegment({ index: i, state: 'talking', at_ms: i * 500, duration_ms: 500 });
    }
    player.start();
    player.finish(3000);
    for (let t = 0; t <= 3200; t += 16) {
      player.tick();
      clock.advance(16);
    }
    expect(player.maxDriftMs).toBeLessThanOrEqual(50);
  });

  it('does nothing before start()', () => {
    const clock = fakeClock();
    const onState = vi.fn();
    const player = new TimelinePlayer({ onState, onImage: () => {}, onEnd: () => {} }, clock.now);
    player.addSegment({ index: 0, state: 'cute', at_ms: 0, duration_ms: 1000 });
    player.tick();
    expect(onState).not.toHaveBeenCalled();
  });
});

describe('TimelinePlayer anchoring', () => {
  it('start(anchor) places t0 in the past so late arrival does not shift the schedule', () => {
    const clock = fakeClock();
    const states: string[] = [];
    const player = new TimelinePlayer({ onState: (s) => states.push(s), onImage: () => {}, onEnd: () => {} }, clock.now);
    clock.advance(2000); // event arrives 2 s after send, but its at_ms is 0
    player.start(clock.now() - 0);
    player.addSegment({ index: 0, state: 'cute', at_ms: 0, duration_ms: 1000 });
    player.tick();
    expect(states).toEqual(['cute']);
  });
});

describe('TimelinePlayer audio', () => {
  it('fires each audio clip once, when its at_ms is reached', () => {
    const clock = fakeClock();
    const played: number[] = [];
    const player = new TimelinePlayer(
      { onState: () => {}, onImage: () => {}, onAudio: (a) => played.push(a.at_ms), onEnd: () => {} },
      clock.now,
    );
    player.addAudio({ at_ms: 0, duration_ms: 1000, char_offset: 0, wav_base64: 'a' });
    player.addAudio({ at_ms: 1000, duration_ms: 1000, char_offset: 5, wav_base64: 'b' });
    player.start();
    player.finish(2000);
    player.tick();
    clock.advance(500);
    player.tick();
    clock.advance(600);
    player.tick();
    clock.advance(1000);
    player.tick();
    expect(played).toEqual([0, 1000]);
  });
});

describe('TimelinePlayer text reveal', () => {
  it('reveals reply text in step with the voice, chunk by chunk', () => {
    const clock = fakeClock();
    const shown: string[] = [];
    const player = new TimelinePlayer(
      { onState: () => {}, onImage: () => {}, onText: (v) => shown.push(v), onEnd: () => {} },
      clock.now,
    );
    player.addText({ delta: 'Hello', char_offset: 0, at_ms: 0, duration_ms: 1000 });
    player.addText({ delta: ' world', char_offset: 5, at_ms: 1000, duration_ms: 1000 });
    player.start();
    player.finish(2000);

    player.tick(); // 0 ms: nothing spoken yet
    clock.advance(500);
    player.tick(); // half of "Hello"
    clock.advance(500);
    player.tick(); // "Hello" done
    clock.advance(1000);
    player.tick(); // whole reply

    // Nothing is emitted while the text is still empty; each change is one emission.
    expect(shown).toEqual(['Hel', 'Hello', 'Hello world']);
  });
});
