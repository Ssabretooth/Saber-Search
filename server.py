#!/usr/bin/env python3
"""
server.py — Saber-Search UI server (Python 3, stdlib only)
===========================================================
Run:
    python3 server.py

Then open your browser at:  http://localhost:3030

What this server does
---------------------
1. Serves ui/index.html — the DexScreener-like meme tracker dashboard.
2. Connects to the XRPL WebSocket (wss://xrplcluster.com) and streams live
   ledger + transaction events to the browser via Server-Sent Events (SSE).
3. Polls DexScreener every 30 s for XRPL meme token pairs and pushes them
   to the UI — enriched with live XRPL order-book data.
4. Exposes a POST /api/pairs endpoint so *your existing bot* can push its own
   pair data to the dashboard instantly:

       import urllib.request, json
       data = json.dumps([pair_dict]).encode()
       req = urllib.request.Request(
           "http://localhost:3030/api/pairs", data=data,
           headers={"Content-Type": "application/json"}, method="POST")
       urllib.request.urlopen(req)

   Or use the helper already in dexscreener.py:

       from dexscreener import push_pairs_to_ui
       push_pairs_to_ui(my_pairs)

Bot → UI event flow
--------------------
    Your Python bot
        │  POST /api/pairs  (push pair dicts in DexScreener schema)
        ▼
    server.py
        │  SSE: event=pairs
        ▼
    ui/index.html (browser)
        → NEW badge + alert animation
"""

from __future__ import annotations

import json
import os
import socketserver
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PORT: int = int(os.environ.get("PORT", "3030"))
XRPL_WS_URL: str = os.environ.get("XRPL_WS", "wss://xrplcluster.com")
DEXSCREENER_BASE: str = "https://api.dexscreener.com"
DEXSCREENER_POLL_SEC: int = 30

MEME_QUERIES: list[str] = [
    "meme", "pepe", "frog", "moon", "dog", "cat", "inu",
    "pixel", "based", "pump", "degen", "shib",
]

UI_FILE: Path = Path(__file__).parent / "ui" / "index.html"

# ---------------------------------------------------------------------------
# In-memory state (thread-safe via _lock)
# ---------------------------------------------------------------------------

_lock = threading.Lock()
_pairs: dict[str, dict] = {}          # pairAddress → enriched pair object
_recent_trades: list[dict] = []       # last 50 XRPL DEX trades
_ledger_info: dict = {}               # latest ledger close info
_xrpl_connected: bool = False
_sse_queues: list[_SSEQueue] = []


# ---------------------------------------------------------------------------
# SSE queue helper
# ---------------------------------------------------------------------------

class _SSEQueue:
    """Thread-safe queue for Server-Sent Events messages."""

    def __init__(self) -> None:
        self._items: list[str] = []
        self._cond = threading.Condition()

    def put(self, msg: str) -> None:
        with self._cond:
            self._items.append(msg)
            self._cond.notify_all()

    def get(self, timeout: float = 25.0) -> str | None:
        with self._cond:
            if self._items:
                return self._items.pop(0)
            self._cond.wait(timeout=timeout)
            return self._items.pop(0) if self._items else None


def _broadcast(event: str, data: object) -> None:
    """Push an SSE message to all connected browser clients."""
    msg = f"event: {event}\ndata: {json.dumps(data)}\n\n"
    with _lock:
        for q in list(_sse_queues):
            q.put(msg)


# ---------------------------------------------------------------------------
# DexScreener poller  (background thread)
# ---------------------------------------------------------------------------

def _dexscreener_worker() -> None:
    """Poll DexScreener every DEXSCREENER_POLL_SEC seconds for XRPL meme pairs."""
    while True:
        try:
            seen: dict[str, dict] = {}
            for query in MEME_QUERIES:
                try:
                    url = f"{DEXSCREENER_BASE}/latest/dex/search?q={urllib.parse.quote(query)}"
                    req = urllib.request.Request(url, headers={"Accept": "application/json"})
                    with urllib.request.urlopen(req, timeout=10) as resp:
                        data = json.loads(resp.read())
                    for pair in data.get("pairs") or []:
                        if pair.get("chainId") == "xrpl" and pair.get("pairAddress"):
                            seen[pair["pairAddress"]] = pair
                except Exception:
                    pass

            if seen:
                # Optionally enrich with live XRPL order-book data
                try:
                    from xrpl_client import XRPLClient  # type: ignore[import]
                    client = XRPLClient()
                    for addr, pair in list(seen.items()):
                        base = pair.get("baseToken") or {}
                        currency = base.get("symbol", "")
                        issuer = base.get("address", "")
                        if currency and issuer:
                            try:
                                book = client.get_token_order_book(currency, issuer)
                                seen[addr] = {**pair, "xrpl": book}
                            except Exception:
                                pass
                except ImportError:
                    pass

                with _lock:
                    _pairs.update(seen)

                _broadcast("pairs", list(seen.values()))
                print(f"[DEX] Pushed {len(seen)} XRPL meme pair(s) to UI")

        except Exception as exc:
            print(f"[DEX] Poll error: {exc}")

        time.sleep(DEXSCREENER_POLL_SEC)


# ---------------------------------------------------------------------------
# XRPL WebSocket worker  (background thread)
# ---------------------------------------------------------------------------

def _xrpl_worker() -> None:
    """Connect to XRPL and stream live ledger + trade events to the UI."""
    global _xrpl_connected

    try:
        from xrpl_client import XRPLClient  # type: ignore[import]
    except ImportError:
        print("[XRPL] xrpl_client.py not found — skipping XRPL stream")
        return

    def _on_event(event: dict) -> None:
        global _xrpl_connected
        _xrpl_connected = True

        ev_type = event.get("type")

        if ev_type == "ledgerClosed":
            with _lock:
                _ledger_info.update({
                    "ledger_index": event.get("ledger_index"),
                    "txn_count": event.get("txn_count"),
                    "close_time_human": event.get("ledger_time"),
                    "fee_base": event.get("fee_base"),
                })
            _broadcast("ledger", dict(_ledger_info))

        elif ev_type == "transaction":
            trade = XRPLClient.extract_dex_trade(event)
            if trade:
                with _lock:
                    _recent_trades.insert(0, trade)
                    del _recent_trades[50:]     # keep last 50
                _broadcast("trade", trade)

    client = XRPLClient(ws_url=XRPL_WS_URL)

    def _reconnect_wrapper() -> None:
        global _xrpl_connected
        while True:
            try:
                print(f"[XRPL] Connecting to {XRPL_WS_URL}…")
                client.subscribe(_on_event)
                # Wait until the thread dies (connection dropped)
                if client._ws_thread:
                    client._ws_thread.join()
            except Exception as exc:
                print(f"[XRPL] Worker error: {exc}")
            _xrpl_connected = False
            _broadcast("xrpl_status", {"connected": False})
            time.sleep(5)

    _reconnect_wrapper()


# ---------------------------------------------------------------------------
# HTTP request handler
# ---------------------------------------------------------------------------

class _Handler(BaseHTTPRequestHandler):

    def log_message(self, fmt: str, *args: object) -> None:  # quieter logs
        if "/api/stream" not in (args[0] if args else ""):
            print(f"[HTTP] {self.address_string()} {fmt % args}")

    # ── CORS pre-flight ───────────────────────────────────────────────────

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    # ── GET routing ───────────────────────────────────────────────────────

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path == "/":
            self._serve_html()
        elif path == "/api/stream":
            self._serve_sse()
        elif path == "/api/state":
            self._serve_state()
        elif path == "/api/trades":
            self._serve_trades()
        elif path == "/api/ledger":
            self._serve_ledger()
        elif path.startswith("/api/dex"):
            self._proxy_dex()
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    # ── POST routing ──────────────────────────────────────────────────────

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/pairs":
            self._receive_pairs()
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    # ── DELETE ────────────────────────────────────────────────────────────

    def do_DELETE(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/pairs":
            with _lock:
                _pairs.clear()
            _broadcast("reset", {})
            self.send_response(204)
            self._cors()
            self.end_headers()
        else:
            self.send_response(404)
            self._cors()
            self.end_headers()

    # ── Route implementations ─────────────────────────────────────────────

    def _serve_html(self) -> None:
        try:
            html = UI_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self._cors()
            self.end_headers()
            self.wfile.write(html)
        except FileNotFoundError:
            self.send_response(404)
            self._cors()
            self.end_headers()
            self.wfile.write(b"ui/index.html not found")

    def _serve_sse(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self._cors()
        self.end_headers()

        q = _SSEQueue()
        with _lock:
            _sse_queues.append(q)
            # Send initial snapshot
            init_pairs = list(_pairs.values())
            init_trades = list(_recent_trades)
            init_ledger = dict(_ledger_info)

        try:
            # Immediately push current state to newly connected client
            for event, data in [
                ("init", {"pairs": init_pairs, "trades": init_trades,
                           "ledger": init_ledger, "xrpl_connected": _xrpl_connected}),
            ]:
                self.wfile.write(f"event: {event}\ndata: {json.dumps(data)}\n\n".encode())
            self.wfile.flush()

            while True:
                msg = q.get(timeout=20)
                if msg is None:
                    # heartbeat
                    self.wfile.write(b": heartbeat\n\n")
                    self.wfile.flush()
                else:
                    self.wfile.write(msg.encode())
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with _lock:
                try:
                    _sse_queues.remove(q)
                except ValueError:
                    pass

    def _serve_state(self) -> None:
        with _lock:
            data = list(_pairs.values())
        self._json_response(data)

    def _serve_trades(self) -> None:
        with _lock:
            data = list(_recent_trades)
        self._json_response(data)

    def _serve_ledger(self) -> None:
        with _lock:
            data = dict(_ledger_info)
        self._json_response(data)

    def _receive_pairs(self) -> None:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        try:
            incoming = json.loads(raw)
        except json.JSONDecodeError:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return

        if isinstance(incoming, dict):
            incoming = [incoming]

        updated: list[dict] = []
        with _lock:
            for pair in incoming:
                addr = pair.get("pairAddress")
                if addr:
                    _pairs[addr] = pair
                    updated.append(pair)

        if updated:
            _broadcast("pairs", updated)

        self._json_response({"ok": True, "count": len(updated)})

    def _proxy_dex(self) -> None:
        """Proxy requests to DexScreener API (avoids any browser CORS issues)."""
        qs = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        dex_path = (qs.get("path") or [""])[0]
        if not dex_path:
            self.send_response(400)
            self._cors()
            self.end_headers()
            return
        try:
            req = urllib.request.Request(
                f"{DEXSCREENER_BASE}{dex_path}",
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except Exception as exc:
            err = json.dumps({"error": str(exc)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.end_headers()
            self.wfile.write(err)

    def _json_response(self, data: object) -> None:
        body = json.dumps(data).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)


# ---------------------------------------------------------------------------
# Threading HTTP server
# ---------------------------------------------------------------------------

class _ThreadingHTTPServer(socketserver.ThreadingMixIn, HTTPServer):
    """Handles each connection in its own thread (required for SSE)."""
    daemon_threads = True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Start background workers
    threading.Thread(target=_dexscreener_worker, daemon=True, name="dex-poll").start()
    threading.Thread(target=_xrpl_worker,        daemon=True, name="xrpl-ws").start()

    server = _ThreadingHTTPServer(("localhost", PORT), _Handler)

    print("=" * 56)
    print("  🗡️  Saber-Search  |  XRPL Meme Tracker")
    print("=" * 56)
    print(f"  Dashboard:    http://localhost:{PORT}")
    print(f"  Bot push:     POST http://localhost:{PORT}/api/pairs")
    print(f"  State:        GET  http://localhost:{PORT}/api/state")
    print(f"  Live trades:  GET  http://localhost:{PORT}/api/trades")
    print(f"  XRPL node:   {XRPL_WS_URL}")
    print("  Press Ctrl+C to stop.")
    print("=" * 56)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped.")
