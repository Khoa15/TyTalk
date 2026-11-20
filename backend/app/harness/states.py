# Orb states the LLM may request. Mirrors ORB_STATES in react/TyTalkOrb.tsx.
ORB_STATES: tuple[str, ...] = (
    "idle",
    "talking",
    "working",
    "cute",
    "surprised",
    "sleepy",
    "angry",
    "laugh",
    "dizzy",
)

MAX_SEGMENTS = 3
MAX_IMAGES = 5
MIN_SECONDS = 0.5
MAX_SECONDS = 8.0

# Orb body forms (eyes stay the same; only the body, glow and background motion change).
ORB_FORMS: tuple[str, ...] = ("orb", "sun", "earth", "moon", "galaxy", "blackhole")

# Entities the Orb can summon on stage (motion is fixed per kind on the client).
ENTITY_KINDS: tuple[str, ...] = (
    "comet",
    "rocket",
    "astronaut",
    "satellite",
    "asteroid",
    "meteor",
    "probe",
)

# Astronomy simulations: id -> {param: allowed values}. Unknown ids or values are dropped.
PLANETS = ("mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune")
SIM_IDS: dict[str, dict[str, tuple[str, ...]]] = {
    "day_night": {"speed": ("slow", "normal", "fast")},
    "seasons": {"hemisphere": ("north", "south")},
    "moon_phases": {"highlight": ("new", "quarter", "full")},
    "solar_eclipse": {"kind": ("total", "partial")},
    "lunar_eclipse": {},
    "solar_system": {"focus": PLANETS},
    "gravity": {"body": ("earth", "moon", "mars", "jupiter")},
    "launch": {},
    "blackhole_lens": {},
    "star_life": {"mass": ("small", "large")},
    "tides": {},
    "aurora": {},
}

MAX_FORMS = 2
MAX_ENTITIES = 3
MAX_SIMS = 1
MAX_ENTITY_COUNT = 5
