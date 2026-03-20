"""
DexScreener API client for Python 3
====================================
Drop this file into your XRPL bot project and import what you need.

No external dependencies — uses Python 3 stdlib only.

Quick-start
-----------
    from dexscreener import search_xrpl_meme_pairs, format_pair

    pairs = search_xrpl_meme_pairs('pepe')
    for p in pairs:
        print(format_pair(p))

Bot integration with the Saber-Search UI server
------------------------------------------------
    import requests  # or use urllib.request (see push_pairs_to_ui below)
    from dexscreener import search_xrpl_meme_pairs

    pairs = search_xrpl_meme_pairs('meme')
    push_pairs_to_ui(pairs)   # streams to the browser dashboard instantly
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL: str = "https://api.dexscreener.com"
XRPL_CHAIN_ID: str = "xrpl"

# ---------------------------------------------------------------------------
# Internal HTTP helper
# ---------------------------------------------------------------------------


def _fetch(path: str) -> Any:
    """GET a DexScreener API endpoint and return parsed JSON."""
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


# ---------------------------------------------------------------------------
# Generic pair endpoints
# ---------------------------------------------------------------------------


def search_pairs(query: str) -> list[dict]:
    """Search DexScreener for trading pairs across all chains.

    Args:
        query: Token symbol, name, or address.

    Returns:
        List of pair dicts from the DexScreener API.
    """
    if not query or not query.strip():
        raise ValueError("query must be a non-empty string")
    data = _fetch(f"/latest/dex/search?q={urllib.parse.quote(query.strip())}")
    return data.get("pairs") or []


def get_token_pairs(token_addresses: str | list[str]) -> list[dict]:
    """Get all pairs for one or more token addresses (up to 30).

    Args:
        token_addresses: A single address string or a list of up to 30.

    Returns:
        List of pair dicts.
    """
    addresses = [token_addresses] if isinstance(token_addresses, str) else list(token_addresses)
    if not addresses:
        raise ValueError("at least one token address is required")
    if len(addresses) > 30:
        raise ValueError("maximum of 30 token addresses can be queried at once")
    joined = ",".join(a.strip() for a in addresses)
    data = _fetch(f"/latest/dex/tokens/{joined}")
    return data.get("pairs") or []


def get_pair(chain_id: str, pair_address: str) -> dict | None:
    """Get a specific trading pair by chain and address.

    Returns:
        Pair dict, or None if not found.
    """
    if not chain_id or not pair_address:
        raise ValueError("chain_id and pair_address are required")
    data = _fetch(
        f"/latest/dex/pairs/{urllib.parse.quote(chain_id)}/{urllib.parse.quote(pair_address)}"
    )
    pairs = data.get("pairs") or []
    return pairs[0] if pairs else None


def get_latest_token_profiles() -> list[dict]:
    """Return the latest token profiles (metadata, icons, links)."""
    data = _fetch("/token-profiles/latest/v1")
    return data if isinstance(data, list) else []


def get_top_boosted_tokens() -> list[dict]:
    """Return tokens with the highest active boosts on DexScreener."""
    data = _fetch("/token-boosts/top/v1")
    return data if isinstance(data, list) else []


# ---------------------------------------------------------------------------
# XRPL-specific helpers
# ---------------------------------------------------------------------------


def search_xrpl_pairs(query: str) -> list[dict]:
    """Search DexScreener and return only XRPL-chain pairs.

    Args:
        query: Token name, symbol, or issuer address.

    Returns:
        List of XRPL pair dicts.
    """
    return [p for p in search_pairs(query) if p.get("chainId") == XRPL_CHAIN_ID]


def get_xrpl_token_pairs(issuer_address: str) -> list[dict]:
    """Get all XRPL pairs for a token issuer address (r…).

    Args:
        issuer_address: XRPL account r-address of the token issuer.

    Returns:
        List of XRPL pair dicts.
    """
    return [p for p in get_token_pairs(issuer_address) if p.get("chainId") == XRPL_CHAIN_ID]


def is_xrpl_meme_pair(
    pair: dict,
    *,
    max_liquidity_usd: float = 500_000,
    max_age_days: float = 30,
    min_change_24h_pct: float = 10,
    min_volume_usd: float = 500,
) -> bool:
    """Return True if a pair looks like an XRPL meme token.

    Heuristics:
      - chainId must be 'xrpl'
      - Liquidity (USD) below max_liquidity_usd
      - Pair listed within max_age_days
      - |24h price change| above min_change_24h_pct
      - 24h volume above min_volume_usd

    All thresholds are keyword-only and have sensible defaults.
    """
    if pair.get("chainId") != XRPL_CHAIN_ID:
        return False

    liquidity = (pair.get("liquidity") or {}).get("usd")
    if liquidity is not None and liquidity > max_liquidity_usd:
        return False

    created_at = pair.get("pairCreatedAt")  # epoch ms
    if created_at is not None:
        age_days = (time.time() * 1_000 - created_at) / 86_400_000
        if age_days > max_age_days:
            return False

    change_24h = abs((pair.get("priceChange") or {}).get("h24") or 0)
    if change_24h < min_change_24h_pct:
        return False

    volume_24h = (pair.get("volume") or {}).get("h24") or 0
    if volume_24h < min_volume_usd:
        return False

    return True


def search_xrpl_meme_pairs(query: str, **meme_options) -> list[dict]:
    """Search DexScreener and return XRPL pairs that pass the meme heuristics.

    Args:
        query: Search term.
        **meme_options: Forwarded to :func:`is_xrpl_meme_pair`
            (max_liquidity_usd, max_age_days, min_change_24h_pct, min_volume_usd).

    Returns:
        Filtered list of meme-like XRPL pair dicts.
    """
    return [p for p in search_xrpl_pairs(query) if is_xrpl_meme_pair(p, **meme_options)]


# ---------------------------------------------------------------------------
# Formatting helpers
# ---------------------------------------------------------------------------


def _format_price(price: float) -> str:
    """Adaptive decimal precision based on magnitude."""
    if price >= 1_000:
        return f"${price:,.2f}"
    if price >= 1:
        return f"${price:.4f}"
    if price >= 0.0001:
        return f"${price:.6f}"
    return f"${price:.4e}"


def format_pair(pair: dict) -> str:
    """Return a human-readable multi-line summary of a pair.

    Example output::

        PEPE/XRP on xrpldex (xrpl)
          Price:      $0.000012
          24h Change: +120.00%
          Liquidity:  $50,000
          24h Volume: $20,000
          Pair:       r...
    """
    base = (pair.get("baseToken") or {}).get("symbol", "?")
    quote = (pair.get("quoteToken") or {}).get("symbol", "?")
    price_usd = pair.get("priceUsd")
    price = _format_price(float(price_usd)) if price_usd is not None else "N/A"
    liq = (pair.get("liquidity") or {}).get("usd")
    liquidity = f"${liq:,.0f}" if liq is not None else "N/A"
    vol = (pair.get("volume") or {}).get("h24")
    volume = f"${vol:,.0f}" if vol is not None else "N/A"
    chg = (pair.get("priceChange") or {}).get("h24")
    change = f"{chg:+.2f}%" if chg is not None else "N/A"
    return "\n".join([
        f"{base}/{quote} on {pair.get('dexId', 'Unknown DEX')} ({pair.get('chainId', 'unknown')})",
        f"  Price:      {price}",
        f"  24h Change: {change}",
        f"  Liquidity:  {liquidity}",
        f"  24h Volume: {volume}",
        f"  Pair:       {pair.get('pairAddress', 'N/A')}",
    ])


# ---------------------------------------------------------------------------
# UI server integration helper
# ---------------------------------------------------------------------------


def push_pairs_to_ui(
    pairs: list[dict] | dict,
    server_url: str = "http://localhost:3030",
) -> bool:
    """Push pair data to the Saber-Search UI server so the dashboard updates live.

    Call this from your bot whenever you detect new or updated XRPL pairs.

    Args:
        pairs: A single pair dict or a list of pair dicts (DexScreener schema).
        server_url: Base URL of the running server.py instance.

    Returns:
        True on success, False if the server is not reachable.

    Example::

        from dexscreener import search_xrpl_meme_pairs, push_pairs_to_ui

        pairs = search_xrpl_meme_pairs('pepe')
        push_pairs_to_ui(pairs)
    """
    if isinstance(pairs, dict):
        pairs = [pairs]
    body = json.dumps(pairs).encode()
    req = urllib.request.Request(
        f"{server_url}/api/pairs",
        data=body,
        headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5):
            return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# XRPL live order-book enrichment
# ---------------------------------------------------------------------------


def enrich_with_xrpl_data(pairs: list[dict], *, timeout: float = 8.0) -> list[dict]:
    """Cross-reference DexScreener pairs with live XRPL order-book data.

    For each pair that has an identifiable XRPL token issuer address, this
    function fetches the current on-chain order book (bids + asks) from the
    XRPL ledger and attaches it as ``pair["xrpl"]``.

    Args:
        pairs:   List of XRPL pair dicts from DexScreener.
        timeout: Per-pair HTTP query timeout in seconds.

    Returns:
        Same list, with a ``"xrpl"`` key added to pairs that have live data.
        Pairs that cannot be enriched are returned unchanged.

    Example::

        from dexscreener import search_xrpl_meme_pairs, enrich_with_xrpl_data
        from xrpl_client import XRPLClient

        pairs = search_xrpl_meme_pairs("pepe")
        pairs = enrich_with_xrpl_data(pairs)

        for p in pairs:
            book = p.get("xrpl", {})
            print(p["baseToken"]["symbol"],
                  "bid:", book.get("best_bid_xrp"),
                  "ask:", book.get("best_ask_xrp"))
    """
    # Lazy import to keep dexscreener.py standalone when xrpl_client is absent.
    try:
        from xrpl_client import XRPLClient  # type: ignore[import]
    except ImportError:
        return pairs

    client = XRPLClient()
    enriched = []

    for pair in pairs:
        base = pair.get("baseToken") or {}
        currency = base.get("symbol", "")
        issuer = base.get("address", "")

        if currency and issuer and pair.get("chainId") == "xrpl":
            try:
                book = client.get_token_order_book(currency, issuer)
                pair = {**pair, "xrpl": book}
            except Exception:
                pass  # leave pair unchanged if XRPL query fails

        enriched.append(pair)

    return enriched


# ---------------------------------------------------------------------------
# CLI — run directly for a quick test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    query = " ".join(sys.argv[1:]) or "pepe"
    print(f"Searching XRPL meme pairs for: {query!r}\n")
    results = search_xrpl_meme_pairs(query)
    if not results:
        print("No meme pairs found — try a different query or loosen the thresholds.")
    else:
        for i, p in enumerate(results[:10], 1):
            print(f"[{i}] {format_pair(p)}\n")
