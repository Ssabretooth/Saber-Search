/**
 * XRPL Meme Token Tracker
 *
 * Core logic for detecting and monitoring meme token activity on the XRP
 * Ledger via the DexScreener API.  The tracker maintains state across poll
 * cycles so it can emit only *new* events (newly seen pairs, price alerts,
 * volume spikes, etc.) rather than re-alerting on every tick.
 */

import {
  searchXrplPairs,
  getXrplTokenPairs,
  isXrplMemePair,
  formatPair,
  XRPL_CHAIN_ID,
} from '../sources/dexscreener.js';

// ---------------------------------------------------------------------------
// Types / constants
// ---------------------------------------------------------------------------

/**
 * Default configuration for the meme tracker.
 *
 * All values can be overridden when constructing a {@link MemeTracker}.
 */
export const DEFAULT_CONFIG = {
  /** Search queries to poll on every tick (token symbols / names). */
  queries: ['XRP', 'meme', 'frog', 'pepe', 'moon', 'inu', 'dog'],

  /** Meme-detection heuristics forwarded to isXrplMemePair(). */
  meme: {
    maxLiquidityUsd: 500_000,
    maxAgeDays: 30,
    minChange24hPct: 10,
  },

  /**
   * Percentage change in 24 h price (absolute) that triggers a
   * PRICE_ALERT event.
   */
  priceAlertThresholdPct: 50,

  /**
   * Minimum 24 h volume (USD) required before a pair is considered
   * worth alerting on.
   */
  minVolumeUsd: 1_000,

  /**
   * Number of consecutive polls a pair must appear in before it is
   * considered "established" and no longer fires NEW_PAIR alerts.
   * (Prevents recurring alerts for the same pair.)
   */
  newPairGracePeriodTicks: 1,
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export const Events = Object.freeze({
  /** A pair was seen for the first time. */
  NEW_PAIR: 'NEW_PAIR',
  /** 24 h price change exceeds the configured threshold. */
  PRICE_ALERT: 'PRICE_ALERT',
  /** 24 h volume crossed the minimum threshold this tick. */
  VOLUME_ALERT: 'VOLUME_ALERT',
});

// ---------------------------------------------------------------------------
// MemeTracker class
// ---------------------------------------------------------------------------

/**
 * Tracks meme token pairs on the XRPL across poll cycles.
 *
 * Usage:
 * ```js
 * const tracker = new MemeTracker({ queries: ['pepe', 'moon'] });
 * tracker.on(Events.NEW_PAIR,    (pair) => console.log('New!', pair.baseToken.symbol));
 * tracker.on(Events.PRICE_ALERT, (pair) => console.log('Pump!', pair.priceChange.h24));
 * await tracker.poll();  // call on a timer, e.g. setInterval
 * ```
 */
export class MemeTracker {
  /**
   * @param {Partial<typeof DEFAULT_CONFIG>} config
   */
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config, meme: { ...DEFAULT_CONFIG.meme, ...(config.meme ?? {}) } };

    /** @type {Map<string, { seenTicks: number, lastChange24h: number }>} */
    this._seen = new Map();

    /** @type {Map<string, Function[]>} */
    this._listeners = new Map();
  }

  // -------------------------------------------------------------------------
  // Event emitter helpers
  // -------------------------------------------------------------------------

  /**
   * Subscribe to tracker events.
   *
   * @param {string} event - One of the {@link Events} constants
   * @param {Function} handler - Called with the pair object when the event fires
   * @returns {this}
   */
  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(handler);
    return this;
  }

  /**
   * Remove a previously registered handler.
   *
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlers = this._listeners.get(event) ?? [];
    this._listeners.set(event, handlers.filter((h) => h !== handler));
  }

  /** @param {string} event @param {object} pair */
  _emit(event, pair) {
    for (const handler of this._listeners.get(event) ?? []) {
      try {
        handler(pair);
      } catch (err) {
        // Don't let a bad handler crash the tracker loop.
        console.error(`[MemeTracker] handler error for "${event}":`, err.message);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Core poll logic
  // -------------------------------------------------------------------------

  /**
   * Run one poll cycle: fetch pairs for all configured queries, apply
   * meme-token filters, and emit events for anything interesting.
   *
   * This is safe to call repeatedly on a timer.
   *
   * @returns {Promise<object[]>} All meme pairs found this tick
   */
  async poll() {
    const { queries, meme, priceAlertThresholdPct, minVolumeUsd, newPairGracePeriodTicks } =
      this._config;

    // Fetch pairs for all queries concurrently.
    const results = await Promise.allSettled(
      queries.map((q) => searchXrplPairs(q))
    );

    /** @type {Map<string, object>} de-duplicated by pairAddress */
    const pairsThisTick = new Map();
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const pair of result.value) {
        if (pair.pairAddress) pairsThisTick.set(pair.pairAddress, pair);
      }
    }

    // Apply meme heuristics.
    const filteredMemePairs = [];
    for (const pair of pairsThisTick.values()) {
      if (!isXrplMemePair(pair, meme)) continue;

      // Skip pairs with insufficient volume (reduces noise).
      const volume24h = pair.volume?.h24 ?? 0;
      if (volume24h < minVolumeUsd) continue;

      filteredMemePairs.push(pair);

      const key = pair.pairAddress;
      const prev = this._seen.get(key);

      if (!prev) {
        // First time we see this pair.
        this._seen.set(key, { seenTicks: 1, lastChange24h: pair.priceChange?.h24 ?? 0 });
        this._emit(Events.NEW_PAIR, pair);
      } else {
        prev.seenTicks += 1;
        const change24h = Math.abs(pair.priceChange?.h24 ?? 0);
        if (change24h >= priceAlertThresholdPct) {
          this._emit(Events.PRICE_ALERT, pair);
        }
        prev.lastChange24h = pair.priceChange?.h24 ?? 0;
      }
    }

    // Prune pairs that have vanished from DexScreener results.
    for (const key of this._seen.keys()) {
      if (!pairsThisTick.has(key)) this._seen.delete(key);
    }

    return filteredMemePairs;
  }

  /**
   * Fetch meme pairs for a specific XRPL token issuer address.
   *
   * @param {string} issuerAddress - XRPL r-address of the token issuer
   * @returns {Promise<object[]>} Meme pairs for this issuer
   */
  async pollToken(issuerAddress) {
    const pairs = await getXrplTokenPairs(issuerAddress);
    return pairs.filter((p) => isXrplMemePair(p, this._config.meme));
  }

  /**
   * Returns the number of distinct XRPL meme pairs currently tracked.
   *
   * @returns {number}
   */
  get trackedCount() {
    return this._seen.size;
  }

  /**
   * Clear all internal state (forget previously seen pairs).
   */
  reset() {
    this._seen.clear();
  }
}
