#!/usr/bin/env python3
"""
Gazette monitor for municipal councillor changes.

Polls the gov.za notices RSS feed and flags any Government Gazette notices
that relate to municipal councillor changes (PR replacements, ward by-elections)
under the Municipal Structures Act or the Electoral Commission.

Run daily via cron:
    0 7 * * * python scripts/gazette_monitor.py >> logs/gazette_monitor.log 2>&1

Output: prints any new relevant notices to stdout (one JSON object per line).
Tracks last-seen notice GUIDs in .gazette_seen to avoid re-reporting.
"""

import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

RSS_URL = "https://www.gov.za/documents/notices/feed"
SEEN_PATH = Path(os.getenv("GAZETTE_SEEN_FILE", ".gazette_seen"))

# Keywords that indicate a municipal councillor change
TRIGGER_PATTERNS = [
    re.compile(r"municipal structures act", re.I),
    re.compile(r"electoral commission", re.I),
    re.compile(r"ward councillor", re.I),
    re.compile(r"proportional representation", re.I),
    re.compile(r"\bpr councillor", re.I),
    re.compile(r"by.?election", re.I),
    re.compile(r"councillor.*replaced|replaced.*councillor", re.I),
]


def load_seen() -> set[str]:
    if SEEN_PATH.exists():
        return set(SEEN_PATH.read_text().splitlines())
    return set()


def save_seen(seen: set[str]) -> None:
    SEEN_PATH.write_text("\n".join(sorted(seen)))


def fetch_rss(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "PublikEye-GazetteMonitor/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def is_relevant(title: str, description: str) -> bool:
    text = f"{title} {description}"
    return any(p.search(text) for p in TRIGGER_PATTERNS)


def parse_feed(content: bytes) -> list[dict]:
    root = ET.fromstring(content)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    items = []

    # Support both RSS 2.0 and Atom
    for item in root.findall(".//item"):
        guid = (item.findtext("guid") or item.findtext("link") or "").strip()
        title = (item.findtext("title") or "").strip()
        description = (item.findtext("description") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()
        items.append({"guid": guid, "title": title, "description": description,
                      "link": link, "pub_date": pub_date})

    for entry in root.findall(".//atom:entry", ns):
        guid = (entry.findtext("atom:id", namespaces=ns) or "").strip()
        title = (entry.findtext("atom:title", namespaces=ns) or "").strip()
        description = (entry.findtext("atom:summary", namespaces=ns) or "").strip()
        link_el = entry.find("atom:link", ns)
        link = (link_el.get("href") if link_el is not None else "") or ""
        pub_date = (entry.findtext("atom:updated", namespaces=ns) or "").strip()
        items.append({"guid": guid, "title": title, "description": description,
                      "link": link, "pub_date": pub_date})

    return items


def main() -> None:
    seen = load_seen()
    now = datetime.now(timezone.utc).isoformat()

    try:
        content = fetch_rss(RSS_URL)
    except Exception as e:
        print(f"ERROR fetching RSS: {e}", file=sys.stderr)
        sys.exit(1)

    items = parse_feed(content)
    new_relevant: list[dict] = []

    for item in items:
        guid = item["guid"]
        if not guid or guid in seen:
            continue
        seen.add(guid)
        if is_relevant(item["title"], item["description"]):
            new_relevant.append({**item, "detected_at": now})

    save_seen(seen)

    for notice in new_relevant:
        print(json.dumps(notice))

    if new_relevant:
        print(
            f"[gazette_monitor] {len(new_relevant)} new councillor-change notice(s) detected.",
            file=sys.stderr,
        )
    else:
        print("[gazette_monitor] No new relevant notices.", file=sys.stderr)


if __name__ == "__main__":
    main()
