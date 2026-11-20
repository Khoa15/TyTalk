import { cometShower, FORMS, flyer, orbitPose, SIMS } from '../src/lib/space/designArt';
import { describe, expect, it } from 'vitest';

import { TimelinePlayer } from '../src/lib/timelinePlayer';

describe('TimelinePlayer space visuals', () => {
  it('turns forms on and off by time and does not touch the speech cursor', () => {
    const forms: (string | null)[] = [];
    let now = 0;
    const player = new TimelinePlayer(
      { onState: () => undefined, onImage: () => undefined, onForm: (f) => forms.push(f), onEnd: () => undefined },
      () => now,
    );
    player.start(0);
    player.addForm({ form: 'moon', at_ms: 100, duration_ms: 1000 });
    player.finish(2000);
    now = 50;
    player.tick();
    now = 500;
    player.tick();
    now = 1200;
    player.tick();
    expect(forms).toEqual(['moon', null]);
  });

  it('reports entity set changes only, not every frame', () => {
    const sets: number[] = [];
    let now = 0;
    const player = new TimelinePlayer(
      { onState: () => undefined, onImage: () => undefined, onEntities: (a) => sets.push(a.length), onEnd: () => undefined },
      () => now,
    );
    player.start(0);
    player.addEntity({ kind: 'comet', count: 1, at_ms: 0, duration_ms: 1000 });
    for (now = 0; now < 900; now += 100) player.tick();
    expect(sets).toEqual([1]);
    now = 1500;
    player.tick();
    expect(sets).toEqual([1, 0]);
  });

  it('reports the active sim and clears it at the end of the reply', () => {
    const sims: (string | null)[] = [];
    let now = 0;
    const player = new TimelinePlayer(
      { onState: () => undefined, onImage: () => undefined, onSim: (s) => sims.push(s?.id ?? null), onEnd: () => undefined },
      () => now,
    );
    player.start(0);
    player.addSim({ id: 'moon_phases', params: {}, at_ms: 0, duration_ms: 800 });
    player.finish(800);
    now = 100;
    player.tick();
    now = 900;
    player.tick();
    expect(sims).toEqual(['moon_phases', null]);
  });
});


describe('design-board art module', () => {
  it('renders every space form, entity and sim as non-empty SVG markup', () => {
    for (const form of ['sun', 'earth', 'moon', 'galaxy', 'blackhole'] as const) {
      expect(FORMS[form](1).length).toBeGreaterThan(200);
    }
    for (const id of Object.keys(SIMS)) {
      expect(SIMS[id].draw(1, 0.5).length).toBeGreaterThan(50);
      expect(SIMS[id].cap(0.5).length).toBeGreaterThan(5);
    }
    for (const kind of ['rocket', 'astronaut', 'satellite', 'probe'] as const) {
      expect(orbitPose(kind, 1).length).toBeGreaterThan(200);
    }
    expect(flyer('meteor', 1, 0.6).length).toBeGreaterThan(200);
  });

  it('draws one comet entity as a shower of parallel streams', () => {
    const shower = cometShower(1, 0.5);
    const streams = shower.match(/<g transform="translate/g) ?? [];
    expect(streams.length).toBe(7);
  });

  it('keeps the comet shower on a single diagonal line', () => {
    expect(cometShower(0.5, 0.5)).toContain('rotate(135)');
  });
});
