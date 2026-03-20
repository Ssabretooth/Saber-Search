"""
xrpl_client.py — XRPL API client for Python 3
================================================
Zero external dependencies. Uses only Python 3 stdlib.

Provides two connection modes:
  1. HTTP JSON-RPC  — synchronous queries (book_offers, account_tx, etc.)
  2. WebSocket      — real-time subscription to ledger + transaction stream

Quick-start
-----------
    from xrpl_client import XRPLClient

    # One-off query
    client = XRPLClient()
    print(client.get_server_info())

    # Subscribe to live DEX trades
    def on_trade(event):
        print("TRADE:", event)

    client.subscribe(on_trade)   # runs in background thread
    # client.close() to stop

Bot integration example
-----------------------
    client = XRPLClient()
    client.subscribe(lambda ev: my_bot.handle_xrpl_event(ev))
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import socket
import ssl
import struct
import threading
import time
import urllib.parse
import urllib.request
from typing import Callable, Any

# ---------------------------------------------------------------------------
# Public XRPL nodes
# ---------------------------------------------------------------------------

HTTP_NODES: list[str] = [
    "https://xrplcluster.com",
    "https://s1.ripple.com:51234",
    "https://s2.ripple.com:51234",
]

WS_URL: str = "wss://xrplcluster.com"

XRPL_CHAIN_ID: str = "xrpl"

# ---------------------------------------------------------------------------
# XRPL currency helpers
# ---------------------------------------------------------------------------

#: 3-letter currency codes that are commonly associated with meme tokens on XRPL.
KNOWN_MEME_CURRENCIES: set[str] = {
    "PEPE", "MEME", "FROG", "MOON", "DOG", "CAT", "INU",
    "SHIB", "DOGE", "BASED", "PUMP", "DEGEN", "PIXEL",
    "APE", "WOJAK", "CHAD", "BONK", "WIF", "BRETT",
}

XRP_DROPS_PER_XRP = 1_000_000


def drops_to_xrp(drops: int | str) -> float:
    """Convert XRPL drops (integer) to XRP."""
    return int(drops) / XRP_DROPS_PER_XRP


def is_meme_currency(currency: str) -> bool:
    """Return True if the currency code looks like a meme token.

    Accepts both 3-letter ISO codes and 20-byte hex currency codes
    (hex codes are decoded to ASCII when printable).
    """
    if len(currency) == 40:
        # Hex-encoded currency — try decoding to ASCII
        try:
            decoded = bytes.fromhex(currency).rstrip(b"\x00").decode("ascii", errors="replace")
            currency = decoded.strip()
        except ValueError:
            return False

    return (
        currency.upper() in KNOWN_MEME_CURRENCIES
        or (len(currency) <= 6 and not currency.startswith("0") and currency.isalpha())
    )


def parse_amount(amount: str | dict) -> tuple[float, str, str | None]:
    """Parse an XRPL amount into (value, currency, issuer).

    Args:
        amount: Either a drops string (XRP) or a token amount dict.

    Returns:
        (value_as_float, currency_code, issuer_or_None)
    """
    if isinstance(amount, str):
        return drops_to_xrp(amount), "XRP", None
    return float(amount.get("value", 0)), amount.get("currency", "?"), amount.get("issuer")


# ---------------------------------------------------------------------------
# Minimal WebSocket client (RFC 6455, stdlib only)
# ---------------------------------------------------------------------------


class _WebSocketClient:
    """Minimal WebSocket client using only Python 3 stdlib (ssl + socket)."""

    def __init__(self, url: str = WS_URL, timeout: int = 30):
        self._url = url
        self._timeout = timeout
        self._sock: ssl.SSLSocket | None = None
        self._lock = threading.Lock()

    # ── Connection ────────────────────────────────────────────────────────

    def connect(self) -> None:
        """Open the WebSocket connection and perform the HTTP upgrade."""
        parsed = urllib.parse.urlparse(self._url)
        host = parsed.hostname
        port = parsed.port or (443 if parsed.scheme == "wss" else 80)
        path = parsed.path or "/"

        raw = socket.create_connection((host, port), timeout=self._timeout)

        if parsed.scheme == "wss":
            ctx = ssl.create_default_context()
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
            self._sock = ctx.wrap_socket(raw, server_hostname=host)
        else:
            self._sock = raw  # type: ignore[assignment]

        # WebSocket opening handshake
        nonce = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host}:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {nonce}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            "\r\n"
        )
        self._sock.sendall(request.encode())

        # Read HTTP response
        response = b""
        while b"\r\n\r\n" not in response:
            chunk = self._sock.recv(4096)
            if not chunk:
                raise ConnectionError("WebSocket: server closed connection during handshake")
            response += chunk

        if b" 101 " not in response:
            raise ConnectionError(
                f"WebSocket upgrade failed. Server response: {response[:200].decode(errors='replace')}"
            )

    # ── Send ─────────────────────────────────────────────────────────────

    def send(self, payload: dict) -> None:
        """Send a JSON payload as a masked WebSocket text frame."""
        data = json.dumps(payload).encode()
        frame = self._build_frame(data, opcode=0x1)  # text frame
        with self._lock:
            self._sock.sendall(frame)

    @staticmethod
    def _build_frame(payload: bytes, opcode: int = 0x1) -> bytes:
        """Build a masked client-to-server WebSocket frame."""
        length = len(payload)
        header = bytearray([0x80 | (opcode & 0x0F)])  # FIN bit + opcode

        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", length))

        mask = os.urandom(4)
        header.extend(mask)
        masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        return bytes(header) + masked

    # ── Receive ───────────────────────────────────────────────────────────

    def recv(self) -> dict | None:
        """Read one WebSocket frame and return parsed JSON, or None on error."""
        try:
            header = self._recv_exactly(2)
            if header is None:
                return None

            opcode = header[0] & 0x0F
            length = header[1] & 0x7F

            if opcode == 0x8:   # close
                return None
            if opcode == 0x9:   # ping — send pong
                self._send_pong()
                return self.recv()
            if opcode == 0xA:   # pong — ignore
                return self.recv()

            if length == 126:
                ext = self._recv_exactly(2)
                length = struct.unpack(">H", ext)[0]
            elif length == 127:
                ext = self._recv_exactly(8)
                length = struct.unpack(">Q", ext)[0]

            raw = self._recv_exactly(length)
            if raw is None:
                return None
            return json.loads(raw.decode())
        except Exception:
            return None

    def _recv_exactly(self, n: int) -> bytes | None:
        buf = b""
        while len(buf) < n:
            chunk = self._sock.recv(n - len(buf))
            if not chunk:
                return None
            buf += chunk
        return buf

    def _send_pong(self) -> None:
        frame = self._build_frame(b"", opcode=0xA)
        with self._lock:
            try:
                self._sock.sendall(frame)
            except Exception:
                pass

    # ── Lifecycle ─────────────────────────────────────────────────────────

    def close(self) -> None:
        if self._sock:
            try:
                self._sock.close()
            except Exception:
                pass
            self._sock = None


# ---------------------------------------------------------------------------
# HTTP JSON-RPC helpers
# ---------------------------------------------------------------------------


def _http_call(method: str, params: dict | None = None, node: str = HTTP_NODES[0]) -> dict:
    """Make a synchronous XRPL HTTP JSON-RPC call.

    Tries the next node in the list on failure.
    """
    body = json.dumps({"method": method, "params": [params or {}]}).encode()
    for url in [node] + [n for n in HTTP_NODES if n != node]:
        try:
            req = urllib.request.Request(
                url,
                data=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read())
            result = data.get("result", {})
            if result.get("status") == "error":
                raise RuntimeError(result.get("error_message") or result.get("error"))
            return result
        except Exception as exc:
            last_exc = exc
            continue
    raise last_exc  # type: ignore[possibly-undefined]


# ---------------------------------------------------------------------------
# XRPLClient — main public API
# ---------------------------------------------------------------------------


class XRPLClient:
    """Unified XRPL client: HTTP queries + optional WebSocket subscription.

    Usage::

        client = XRPLClient()

        # One-off query
        info = client.get_server_info()

        # Get order book for a meme token
        book = client.get_book_offers("PEPE", "rIssuer...", "XRP", None)

        # Subscribe to live DEX trade events (runs in background thread)
        def on_event(event):
            if event.get("type") == "transaction":
                print("New XRPL tx:", event["transaction"]["TransactionType"])

        client.subscribe(on_event)
        # ... your bot logic ...
        client.close()
    """

    def __init__(self, http_node: str = HTTP_NODES[0], ws_url: str = WS_URL):
        self._http_node = http_node
        self._ws_url = ws_url
        self._ws: _WebSocketClient | None = None
        self._ws_thread: threading.Thread | None = None
        self._running = False
        self._callbacks: list[Callable[[dict], Any]] = []

    # ── HTTP queries ──────────────────────────────────────────────────────

    def call(self, method: str, params: dict | None = None) -> dict:
        """Make a raw XRPL JSON-RPC call and return the result dict."""
        return _http_call(method, params, node=self._http_node)

    def get_server_info(self) -> dict:
        """Return info about the connected XRPL server node."""
        return self.call("server_info")

    def get_ledger_info(self) -> dict:
        """Return metadata about the latest validated ledger."""
        return self.call("ledger", {"ledger_index": "validated", "transactions": False})

    def get_book_offers(
        self,
        taker_pays_currency: str,
        taker_pays_issuer: str | None,
        taker_gets_currency: str,
        taker_gets_issuer: str | None,
        limit: int = 20,
    ) -> list[dict]:
        """Get current DEX order book offers for a currency pair.

        Args:
            taker_pays_currency: Currency the taker will pay (e.g. "XRP" or "PEPE").
            taker_pays_issuer:   Issuer r-address, or None for XRP.
            taker_gets_currency: Currency the taker will receive.
            taker_gets_issuer:   Issuer r-address, or None for XRP.
            limit:               Max offers to return.

        Returns:
            List of offer dicts from the XRPL ledger.
        """

        def _cur(currency: str, issuer: str | None) -> dict:
            return {"currency": currency} if currency == "XRP" else {"currency": currency, "issuer": issuer}

        result = self.call("book_offers", {
            "taker_pays": _cur(taker_pays_currency, taker_pays_issuer),
            "taker_gets": _cur(taker_gets_currency, taker_gets_issuer),
            "limit": limit,
        })
        return result.get("offers", [])

    def get_token_order_book(self, currency: str, issuer: str) -> dict:
        """Return a structured order book (bids + asks) for a TOKEN/XRP pair.

        Derives the best bid price, best ask price, and spread.
        """
        # Bids: someone pays XRP to get TOKEN
        bids = self.get_book_offers("XRP", None, currency, issuer, limit=10)
        # Asks: someone pays TOKEN to get XRP
        asks = self.get_book_offers(currency, issuer, "XRP", None, limit=10)

        def _bid_price(offer: dict) -> float | None:
            """XRP per token (how much XRP you get per token sold)."""
            try:
                pays_xrp = drops_to_xrp(offer["TakerPays"])
                gets_val = float(offer["TakerGets"]["value"])
                return pays_xrp / gets_val if gets_val else None
            except Exception:
                return None

        def _ask_price(offer: dict) -> float | None:
            """XRP per token (how much XRP you pay per token bought)."""
            try:
                gets_xrp = drops_to_xrp(offer["TakerGets"])
                pays_val = float(offer["TakerPays"]["value"])
                return gets_xrp / pays_val if pays_val else None
            except Exception:
                return None

        parsed_bids = [p for o in bids if (p := _bid_price(o)) is not None]
        parsed_asks = [p for o in asks if (p := _ask_price(o)) is not None]

        best_bid = max(parsed_bids) if parsed_bids else None
        best_ask = min(parsed_asks) if parsed_asks else None
        spread_pct = (
            (best_ask - best_bid) / best_bid * 100
            if best_bid and best_ask and best_bid > 0
            else None
        )

        return {
            "currency": currency,
            "issuer": issuer,
            "bids": bids[:5],
            "asks": asks[:5],
            "best_bid_xrp": best_bid,
            "best_ask_xrp": best_ask,
            "mid_price_xrp": ((best_bid + best_ask) / 2) if best_bid and best_ask else None,
            "spread_pct": spread_pct,
            "bid_count": len(bids),
            "ask_count": len(asks),
        }

    def get_account_offers(self, account: str, limit: int = 200) -> list[dict]:
        """Get active DEX offers from an XRPL account."""
        result = self.call("account_offers", {"account": account, "limit": limit})
        return result.get("offers", [])

    def get_account_lines(self, account: str, limit: int = 200) -> list[dict]:
        """Get trust lines (token holdings) for an XRPL account."""
        result = self.call("account_lines", {"account": account, "limit": limit})
        return result.get("lines", [])

    def get_account_tx(self, account: str, limit: int = 20) -> list[dict]:
        """Get recent transactions for an XRPL account."""
        result = self.call("account_tx", {
            "account": account,
            "limit": limit,
            "ledger_index_min": -1,
            "ledger_index_max": -1,
        })
        return result.get("transactions", [])

    def get_account_info(self, account: str) -> dict:
        """Get account metadata (balance, sequence, etc.)."""
        return self.call("account_info", {"account": account, "ledger_index": "current"})

    # ── WebSocket subscription ────────────────────────────────────────────

    def subscribe(
        self,
        callback: Callable[[dict], Any],
        *,
        accounts: list[str] | None = None,
        streams: list[str] | None = None,
    ) -> None:
        """Subscribe to the XRPL transaction stream (runs in a daemon thread).

        The *callback* is called with each incoming event dict from the XRPL.
        Events include ``{"type": "transaction", ...}`` for each validated tx
        and ``{"type": "ledgerClosed", ...}`` on every ledger close (~4s).

        Args:
            callback: Function called with each XRPL event dict.
            accounts: Optional list of r-addresses to watch specifically.
            streams:  Subscription streams (default: ["ledger", "transactions"]).
        """
        self._callbacks.append(callback)

        if self._running:
            return  # already connected

        self._running = True
        self._ws_thread = threading.Thread(
            target=self._ws_loop,
            kwargs={"accounts": accounts, "streams": streams or ["ledger", "transactions"]},
            daemon=True,
            name="xrpl-ws",
        )
        self._ws_thread.start()

    def _ws_loop(self, accounts: list[str] | None, streams: list[str]) -> None:
        """WebSocket connection loop with automatic reconnection."""
        backoff = 2
        while self._running:
            try:
                self._ws = _WebSocketClient(self._ws_url)
                self._ws.connect()

                sub_cmd: dict = {"id": "sub-1", "command": "subscribe", "streams": streams}
                if accounts:
                    sub_cmd["accounts"] = accounts
                self._ws.send(sub_cmd)

                backoff = 2  # reset on successful connect
                print(f"[XRPL] Connected to {self._ws_url}")

                while self._running:
                    msg = self._ws.recv()
                    if msg is None:
                        break
                    if msg.get("type") in ("transaction", "ledgerClosed", "validationReceived"):
                        for cb in self._callbacks:
                            try:
                                cb(msg)
                            except Exception as exc:
                                print(f"[XRPL] callback error: {exc}")

            except Exception as exc:
                if self._running:
                    print(f"[XRPL] Connection error: {exc} — reconnecting in {backoff}s")
                    time.sleep(backoff)
                    backoff = min(backoff * 2, 60)
            finally:
                if self._ws:
                    self._ws.close()
                    self._ws = None

    def close(self) -> None:
        """Stop the WebSocket subscription thread."""
        self._running = False
        if self._ws:
            self._ws.close()

    # ── Convenience ───────────────────────────────────────────────────────

    @staticmethod
    def extract_dex_trade(event: dict) -> dict | None:
        """Extract meme token trade info from an XRPL transaction event.

        Returns a dict with trade details if the transaction is a DEX
        OfferCreate involving a meme token, otherwise returns None.

        Example return value::

            {
                "account":    "rTrader...",
                "pays":       {"value": 5.0,   "currency": "XRP",  "issuer": None},
                "gets":       {"value": 1000.0,"currency": "PEPE", "issuer": "rIssuer..."},
                "type":       "buy",         # "buy" or "sell"
                "is_meme":    True,
                "ledger_index": 12345678,
                "timestamp":  1710000000,
            }
        """
        tx = event.get("transaction") or event.get("tx")
        if not tx:
            return None
        if tx.get("TransactionType") != "OfferCreate":
            return None

        pays = tx.get("TakerPays")
        gets = tx.get("TakerGets")
        if pays is None or gets is None:
            return None

        pays_val, pays_cur, pays_issuer = parse_amount(pays)
        gets_val, gets_cur, gets_issuer = parse_amount(gets)

        # Only interested in XRP ↔ token trades
        involves_xrp = pays_cur == "XRP" or gets_cur == "XRP"
        involves_token = pays_cur != "XRP" or gets_cur != "XRP"
        if not (involves_xrp and involves_token):
            return None

        token_currency = gets_cur if gets_cur != "XRP" else pays_cur
        token_issuer = gets_issuer if gets_cur != "XRP" else pays_issuer

        return {
            "account": tx.get("Account"),
            "pays": {"value": pays_val, "currency": pays_cur, "issuer": pays_issuer},
            "gets": {"value": gets_val, "currency": gets_cur, "issuer": gets_issuer},
            "type": "buy" if gets_cur != "XRP" else "sell",
            "token_currency": token_currency,
            "token_issuer": token_issuer,
            "is_meme": is_meme_currency(token_currency),
            "ledger_index": event.get("ledger_index"),
            "timestamp": event.get("transaction", {}).get("date"),
            "hash": tx.get("hash"),
        }


# ---------------------------------------------------------------------------
# CLI — quick connectivity test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    print("Testing XRPL connection...")
    client = XRPLClient()

    try:
        info = client.get_server_info()
        server = info.get("info", {})
        print(f"  Node:         {server.get('hostid', 'unknown')}")
        print(f"  Version:      {server.get('build_version', 'unknown')}")
        print(f"  Ledger:       #{server.get('validated_ledger', {}).get('seq', '?')}")
        print(f"  Load:         {server.get('load_factor', 1)}")
    except Exception as e:
        print(f"  ERROR: {e}")
        sys.exit(1)

    currency = sys.argv[1] if len(sys.argv) > 1 else "PEPE"
    issuer = sys.argv[2] if len(sys.argv) > 2 else None

    if issuer:
        print(f"\nOrder book for {currency}/{issuer}:")
        book = client.get_token_order_book(currency, issuer)
        print(f"  Best bid:  {book['best_bid_xrp']} XRP")
        print(f"  Best ask:  {book['best_ask_xrp']} XRP")
        print(f"  Spread:    {book['spread_pct']:.2f}%" if book["spread_pct"] else "  Spread:    N/A")
        print(f"  Bids/Asks: {book['bid_count']} / {book['ask_count']}")
    else:
        print("\nSubscribing to XRPL transaction stream for 10 seconds...")
        trades = []

        def on_event(ev: dict) -> None:
            trade = XRPLClient.extract_dex_trade(ev)
            if trade:
                trades.append(trade)
                flag = "🔥 MEME" if trade["is_meme"] else "   DEX"
                print(f"  {flag}  {trade['type'].upper():4}  "
                      f"{trade['gets']['value']:12.4f} {trade['gets']['currency']:6} "
                      f"/ {trade['pays']['value']:10.4f} {trade['pays']['currency']}")
            elif ev.get("type") == "ledgerClosed":
                print(f"  Ledger #{ev.get('ledger_index')} closed — "
                      f"{ev.get('txn_count', 0)} txns")

        client.subscribe(on_event)
        time.sleep(10)
        client.close()
        print(f"\nCaptured {len(trades)} DEX trades ({sum(1 for t in trades if t['is_meme'])} meme).")
