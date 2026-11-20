/** Shared cartoon line-art tokens: bold ink outline, flat bright fills, rounded joins. */
export const INK = '#1c1233';

export const TOON = {
  stroke: INK,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const,
};

/** Flat fills used across the space art so every object looks like it belongs to the same drawing. */
export const COLORS = {
  sun: '#ffcf3f',
  sunRay: '#ff9d2e',
  blush: '#ff8a8a',
  earthSea: '#4cb8ff',
  earthLand: '#6bd36b',
  cloud: '#ffffff',
  moon: '#efe9d6',
  moonCrater: '#d3ccb6',
  space: '#2d2063',
  star: '#fff3b0',
  fire: '#ff7a3d',
  flame: '#ffd34d',
  rocketRed: '#ff5d6c',
  steel: '#cdd3e6',
  panel: '#5a7bff',
  gold: '#ffc94a',
  rock: '#b08968',
};
