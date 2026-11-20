import asyncio
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx


@dataclass(frozen=True)
class ImageResult:
    query: str
    url: str
    caption: str


class ImageSearchTool:
    """Read-only image lookup on Wikimedia Commons.

    The API host is fixed, so no user- or LLM-controlled URL is ever fetched (SSRF guard).
    Returned image URLs must also match the host allowlist.
    """

    API_URL = "https://commons.wikimedia.org/w/api.php"
    HEADERS = {"User-Agent": "TyTalk/1.0 (educational illustration lookup)"}

    def __init__(self, allowed_hosts: list[str], timeout_s: float = 3.0) -> None:
        self._allowed_hosts = set(allowed_hosts)
        self._timeout = timeout_s

    async def search_many(self, queries: list[str]) -> dict[str, ImageResult]:
        if not queries:
            return {}
        try:
            async with httpx.AsyncClient(timeout=self._timeout, headers=self.HEADERS) as client:
                results = await asyncio.wait_for(
                    asyncio.gather(*(self._search(client, q) for q in queries)),
                    timeout=self._timeout,
                )
        except (asyncio.TimeoutError, httpx.HTTPError):
            return {}
        return {r.query: r for r in results if r is not None}

    async def _search(self, client: httpx.AsyncClient, query: str) -> ImageResult | None:
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": 6,
            "gsrlimit": 3,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 800,
        }
        try:
            resp = await client.get(self.API_URL, params=params)
            pages = (resp.json().get("query") or {}).get("pages") or {}
        except (httpx.HTTPError, ValueError):
            return None

        for page in sorted(pages.values(), key=lambda p: p.get("index", 0)):
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl")
            if url and self._is_allowed(url):
                caption = str(page.get("title", "")).removeprefix("File:")
                return ImageResult(query=query, url=url, caption=caption)
        return None

    def _is_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.scheme == "https" and parsed.hostname in self._allowed_hosts
