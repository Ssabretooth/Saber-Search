import time
import urllib.robotparser
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from .config import ClearedSource
from .errors import SourceGateError

USER_AGENT_TMPL = (
    "PublikEyeBot/0.1 (transparency research; contact: {email})"
)


@dataclass
class FetchResult:
    url: str
    status: int
    content: bytes
    content_type: str


def _robots_allows(client: httpx.Client, url: str, ua: str) -> bool:
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    rp = urllib.robotparser.RobotFileParser()
    try:
        r = client.get(robots_url, timeout=10.0)
        if r.status_code == 404:
            return True
        if r.status_code >= 500:
            return False
        rp.parse(r.text.splitlines())
    except httpx.HTTPError:
        return False
    return rp.can_fetch(ua, url)


def fetch(source: ClearedSource, *, retries: int = 4) -> FetchResult:
    ua = USER_AGENT_TMPL.format(email=source.contact_email)
    headers = {"User-Agent": ua, "Accept": "*/*"}
    interval = 1.0 / source.rate_limit_rps

    with httpx.Client(headers=headers, follow_redirects=True) as client:
        if not _robots_allows(client, source.url, ua):
            raise SourceGateError(
                f"robots.txt disallows {source.url} for UA {ua!r}"
            )

        last_err = None
        last_t = 0.0
        for attempt in range(retries):
            now = time.monotonic()
            if attempt > 0 and now - last_t < interval:
                time.sleep(interval - (now - last_t))
            last_t = time.monotonic()
            try:
                r = client.get(source.url, timeout=30.0)
                if r.status_code == 429 or 500 <= r.status_code < 600:
                    raise httpx.HTTPStatusError(
                        f"retryable {r.status_code}",
                        request=r.request, response=r,
                    )
                r.raise_for_status()
                return FetchResult(
                    url=str(r.url),
                    status=r.status_code,
                    content=r.content,
                    content_type=r.headers.get("content-type", ""),
                )
            except (httpx.TransportError, httpx.HTTPStatusError) as e:
                last_err = e
                time.sleep(min(2 ** attempt, 30))

        raise SourceGateError(
            f"fetch failed after {retries} attempts: {last_err}"
        )
