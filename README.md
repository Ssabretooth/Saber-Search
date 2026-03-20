# Saber-Search

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
