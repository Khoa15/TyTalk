import threading
import time
from collections.abc import Callable


class RateLimiter:
    """In-process token bucket keyed by an arbitrary string (IP, user id...).

    Single-instance monolith for now. To scale out, replace the storage with
    Redis behind the same `hit` interface.
    """

    def __init__(self, capacity: int, per_seconds: float, clock: Callable[[], float] = time.monotonic):
        self._cap = float(capacity)
        self._rate = capacity / per_seconds
        self._clock = clock
        self._buckets: dict[str, tuple[float, float]] = {}
        self._lock = threading.Lock()

    def hit(self, key: str) -> float:
        """Consume one token. Returns 0 if allowed, otherwise seconds until retry."""
        now = self._clock()
        with self._lock:
            tokens, last = self._buckets.get(key, (self._cap, now))
            tokens = min(self._cap, tokens + (now - last) * self._rate)
            if tokens >= 1:
                self._buckets[key] = (tokens - 1, now)
                return 0.0
            self._buckets[key] = (tokens, now)
            return (1 - tokens) / self._rate

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()
