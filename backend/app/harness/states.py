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
