# Saber-Search — XRPL Meme Tracker

A DexScreener-like dashboard for tracking meme tokens on the **XRP Ledger**,
plugged directly into both the **XRPL API** (live ledger + DEX order book) and
the **DexScreener public API** (price, volume, liquidity).

Zero npm/pip dependencies for the core files — drop them straight into VS Code.

---

## Files — paste these into your VS Code project

| File | What it is |
|---|---|
| `ui/index.html` | **The dashboard** — open in any browser or VS Code Live Server |
| `dexscreener.py` | Python 3 DexScreener API client — import into your bot |
| `xrpl_client.py` | Python 3 XRPL HTTP + WebSocket client — import into your bot |
| `server.py` | Python 3 bridge server — connects XRPL + DexScreener → UI |

---

## Quick start (VS Code)

### Option A — Open the dashboard directly (no server needed)

```
ui/index.html → right-click → Open with Live Server
```

The dashboard fetches XRPL pairs from DexScreener in the browser.
No Python needed. The XRPL trade feed will be empty until you run the server.

---

### Option B — Full live feed (Python server + XRPL WebSocket)

```bash
python3 server.py
```

Then open: **http://localhost:3030**

The server will:
1. Connect to `wss://xrplcluster.com` — live XRPL ledger subscription
2. Stream DEX trade events to the browser in real-time (right-hand panel)
3. Poll DexScreener every 30 s for XRPL meme pairs
4. Enrich each pair with its live on-chain order book (bids + asks)

---

## Bot integration — push your own pair data to the UI

In your existing Python 3 bot, use the built-in helper:

```python
from dexscreener import search_xrpl_meme_pairs, push_pairs_to_ui

# Detect meme pairs
pairs = search_xrpl_meme_pairs('pepe', max_liquidity_usd=200_000, min_change_24h_pct=20)

# Push to dashboard instantly (server.py must be running)
push_pairs_to_ui(pairs)
```

Or with raw `urllib.request` (no extra imports):

```python
import urllib.request, json

pair = {
    "pairAddress": "rMyPairAddress...",
    "chainId":     "xrpl",
    "baseToken":   {"symbol": "PEPE", "name": "Pepe Coin", "address": "rIssuer..."},
    "quoteToken":  {"symbol": "XRP"},
    "priceUsd":    "0.000012",
    "priceChange": {"h1": 5.2, "h6": 18.4, "h24": 120.0},
    "volume":      {"h24": 45000},
    "liquidity":   {"usd": 12000},
    "pairCreatedAt": 1710000000000,
    "dexId":       "xrpldex",
}

body = json.dumps([pair]).encode()
req  = urllib.request.Request(
    "http://localhost:3030/api/pairs", data=body,
    headers={"Content-Type": "application/json"}, method="POST")
urllib.request.urlopen(req)
```

---

## XRPL API client (`xrpl_client.py`)

```python
from xrpl_client import XRPLClient

client = XRPLClient()

# Query the live order book for a XRPL meme token
book = client.get_token_order_book("PEPE", "rIssuerAddress...")
print("Best bid:", book["best_bid_xrp"], "XRP")
print("Best ask:", book["best_ask_xrp"], "XRP")
print("Spread:  ", book["spread_pct"], "%")

# Get recent transactions for an account
txns = client.get_account_tx("rYourBotAddress...", limit=20)

# Subscribe to live XRPL DEX trade events (background thread)
def on_event(event):
    trade = XRPLClient.extract_dex_trade(event)
    if trade and trade["is_meme"]:
        print(f"🔥 MEME TRADE: {trade['type']} {trade['token_currency']}")

client.subscribe(on_event)
# ... your bot logic ...
client.close()
```

Test the XRPL connection from the terminal:

```bash
# Basic connectivity test
python3 xrpl_client.py

# Watch live DEX trades for 10 seconds
python3 xrpl_client.py

# Check order book for a specific token
python3 xrpl_client.py PEPE rIssuerAddress...
```

---

## DexScreener API client (`dexscreener.py`)

```python
from dexscreener import (
    search_xrpl_meme_pairs,
    get_xrpl_token_pairs,
    enrich_with_xrpl_data,
    format_pair,
    push_pairs_to_ui,
)

# Search for meme pairs on XRPL
pairs = search_xrpl_meme_pairs('pepe')

# Enrich with live XRPL order-book data
pairs = enrich_with_xrpl_data(pairs)

for p in pairs:
    print(format_pair(p))
    book = p.get('xrpl', {})
    if book:
        print(f"  On-chain bid: {book['best_bid_xrp']} XRP")
```

Quick test:

```bash
python3 dexscreener.py pepe
python3 dexscreener.py moon
```

---

## Server API endpoints

| Method | Path | Description |
|---|---|---|
| `GET`    | `/`             | Serve `ui/index.html` |
| `GET`    | `/api/stream`   | SSE stream → browser receives XRPL + DexScreener events |
| `POST`   | `/api/pairs`    | Bot pushes pair data (JSON array) |
| `GET`    | `/api/state`    | Current tracked pairs as JSON |
| `GET`    | `/api/trades`   | Recent XRPL DEX trades as JSON |
| `GET`    | `/api/ledger`   | Latest XRPL ledger close info |
| `DELETE` | `/api/pairs`    | Clear all tracked pairs |
| `GET`    | `/api/dex?path=…` | CORS proxy to DexScreener API |

---

## Dashboard features

| Feature | Source |
|---|---|
| Token table (price, 1h/6h/24h change, volume, liquidity, age) | DexScreener API |
| XRPL network bar (ledger #, tx count, live trade counter) | XRPL WebSocket |
| Live trade feed (right panel, real-time DEX offers) | XRPL WebSocket |
| On-chain order book in pair modal (bids + asks) | XRPL HTTP JSON-RPC |
| ⛓ badge on pairs with live order-book data | XRPL HTTP JSON-RPC |
| 🔥 badge on pumping pairs (|24h| ≥ 50%) | DexScreener |
| 🆕 badge on pairs first seen this session | Session state |
| Meme filter toggle (liquidity / age / volatility) | Local heuristics |
| Filter tabs: All / New / Trending / Alerts / On-Chain | Local |
| Auto-refresh every 30 s | DexScreener |
| Click row → pair detail modal with order book | Both |

---

## Running the Node.js CLI (optional)

```bash
node src/index.js search ETH
node src/index.js xrpl pepe
node src/index.js track pepe,moon,frog 30
node src/index.js trending
```


A DeFi search and meme-token tracking tool for the **XRP Ledger (XRPL)**, powered by the [DexScreener](https://dexscreener.com) public API.

## Requirements

- Node.js ≥ 18 (uses the built-in `fetch` API — no extra dependencies needed)

## Installation

```bash
git clone https://github.com/Ssabretooth/Saber-Search.git
cd Saber-Search
```

No `npm install` required — the project has zero runtime dependencies.

## CLI Usage

### Search all chains

```bash
node src/index.js search <query>
# e.g.
node src/index.js search ETH
```

### Search XRPL pairs only

```bash
node src/index.js xrpl <query>
# e.g.
node src/index.js xrpl pepe
node src/index.js xrpl moon
```

### Look up a specific token (by address/issuer)

```bash
node src/index.js token <tokenAddress>
# e.g. (XRPL issuer address)
node src/index.js token rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh
```

### Look up a specific trading pair

```bash
node src/index.js pair <chainId> <pairAddress>
# e.g.
node src/index.js pair xrpl <pairAddress>
```

### Trending / boosted tokens

```bash
node src/index.js trending
```

### 🤖 XRPL Meme Tracker Bot

Start the long-running bot that polls DexScreener for new meme tokens on XRPL and alerts on price pumps:

```bash
# Default queries, 60-second interval
node src/index.js track

# Custom queries and interval (seconds)
node src/index.js track pepe,moon,frog,inu 30
```

The bot prints alerts like:

```
[2024-01-15T10:30:00.000Z] 🤖 XRPL Meme Tracker Bot started — polling every 60s
   Watching queries: pepe, moon, frog, inu

[2024-01-15T10:30:01.123Z] 🚨 NEW XRPL MEME PAIR DETECTED
PEPE/XRP on xrpldex (xrpl)
  Price:      $0.000001
  24h Change: +120%
  Liquidity:  $50,000
  24h Volume: $20,000
  Pair:       r...

[2024-01-15T10:30:01.456Z] 🔥 PRICE ALERT  MOON  +75% (24 h)
...

[2024-01-15T10:31:01.000Z] ✅ Poll complete — 3 XRPL meme pair(s) found (tracking 5 total)
```

Press **Ctrl+C** to stop the bot.

## Embedding the Bot in Your Own Code

```js
import { startBot } from './src/tracker/bot.js';
import { Events } from './src/tracker/memeTracker.js';

const bot = startBot({
  queries: ['pepe', 'moon', 'frog'],
  intervalMs: 30_000,           // 30-second polling
  silent: true,                 // suppress default stdout output
  onNewPair: (pair) => {
    // send to your Discord/Telegram/webhook
    console.log(`New XRPL meme: ${pair.baseToken.symbol}`);
  },
  onPriceAlert: (pair) => {
    console.log(`Pump! ${pair.baseToken.symbol} is ${pair.priceChange.h24}% up`);
  },
});

// Access the underlying tracker for custom event subscriptions
bot.tracker.on(Events.PRICE_ALERT, (pair) => { /* ... */ });

// Stop the bot cleanly
setTimeout(() => bot.stop(), 5 * 60 * 1000);
```

## DexScreener API Source

The `src/sources/dexscreener.js` module exposes the following functions:

| Function | Description |
|---|---|
| `searchPairs(query)` | Search all chains for trading pairs |
| `searchXrplPairs(query)` | Search XRPL pairs only |
| `getTokenPairs(addresses)` | Get pairs for one or more token addresses |
| `getXrplTokenPairs(issuer)` | Get XRPL pairs for an issuer address |
| `getPair(chainId, pairAddress)` | Get a specific pair by chain + address |
| `getLatestTokenProfiles()` | Get latest token profiles (metadata/icons) |
| `getTopBoostedTokens()` | Get tokens with the highest active boosts |
| `isXrplMemePair(pair, options?)` | Heuristic check — is this an XRPL meme pair? |
| `searchXrplMemePairs(query, options?)` | Search + filter for XRPL meme pairs |
| `formatPair(pair)` | Format a pair as a human-readable string |

## Meme-Detection Heuristics

`isXrplMemePair()` uses three configurable thresholds:

| Option | Default | Meaning |
|---|---|---|
| `maxLiquidityUsd` | `500,000` | Liquidity must be below this value |
| `maxAgeDays` | `30` | Pair must have been listed within this many days |
| `minChange24hPct` | `10` | Absolute 24 h price change must exceed this % |

Pass custom values to tune for your strategy:

```js
import { isXrplMemePair } from './src/sources/dexscreener.js';

const isAggressive = isXrplMemePair(pair, {
  maxLiquidityUsd: 100_000,
  maxAgeDays: 7,
  minChange24hPct: 25,
});
```

## Running Tests

```bash
node --test src/sources/dexscreener.test.js src/tracker/memeTracker.test.js
```

## License

MIT
