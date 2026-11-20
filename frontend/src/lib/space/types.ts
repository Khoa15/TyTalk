/** Shared names for the space visuals. Must match the backend whitelists in app/harness/states.py. */
export const ORB_FORMS = ['orb', 'sun', 'earth', 'moon', 'galaxy', 'blackhole'] as const;
export type OrbForm = (typeof ORB_FORMS)[number];

export const ENTITY_KINDS = ['comet', 'rocket', 'astronaut', 'satellite', 'asteroid', 'meteor', 'probe'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const SIM_IDS = [
  'day_night', 'seasons', 'moon_phases', 'solar_eclipse', 'lunar_eclipse', 'solar_system',
  'gravity', 'launch', 'blackhole_lens', 'star_life', 'tides', 'aurora',
] as const;
export type SimId = (typeof SIM_IDS)[number];

export interface SimEvt {
  id: SimId;
  params: Record<string, string>;
  at_ms: number;
  duration_ms: number;
}
