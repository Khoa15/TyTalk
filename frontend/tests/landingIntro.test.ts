import { revealCounts, wordStarts } from '../src/lib/landingIntro';

describe('landing intro timing', () => {
  it('places words back to back', () => {
    expect(wordStarts([700, 600, 800])).toEqual([0, 700, 1300]);
  });

  it('types each word across its own clip, in step with the voice', () => {
    const words = ['Hi!', 'I am', 'TyTalk'];
    const durations = [700, 600, 800];
    const starts = wordStarts(durations);
    expect(revealCounts(0, starts, durations, words)).toEqual([0, 0, 0]);
    expect(revealCounts(350, starts, durations, words)).toEqual([1, 0, 0]); // half of "Hi!"
    expect(revealCounts(1000, starts, durations, words)).toEqual([3, 2, 0]); // "I am" half typed
    expect(revealCounts(5000, starts, durations, words)).toEqual([3, 4, 6]); // everything shown
  });
});
