from app.core.ratelimit import RateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_bucket_allows_capacity_then_blocks_with_retry_after():
    clock = FakeClock()
    limiter = RateLimiter(capacity=2, per_seconds=60, clock=clock)
    assert limiter.hit("u1") == 0
    assert limiter.hit("u1") == 0
    retry = limiter.hit("u1")
    assert retry > 0
    assert retry <= 30.0  # one token refills every 30s at 2/min


def test_bucket_refills_over_time():
    clock = FakeClock()
    limiter = RateLimiter(capacity=1, per_seconds=60, clock=clock)
    assert limiter.hit("u1") == 0
    assert limiter.hit("u1") > 0
    clock.now += 60
    assert limiter.hit("u1") == 0


def test_keys_are_independent():
    clock = FakeClock()
    limiter = RateLimiter(capacity=1, per_seconds=60, clock=clock)
    assert limiter.hit("alice") == 0
    assert limiter.hit("bob") == 0
