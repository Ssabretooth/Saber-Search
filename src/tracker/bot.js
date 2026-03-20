/**
 * XRPL Meme Tracker Bot
 *
 * A long-running polling bot that wraps {@link MemeTracker} and logs
 * events to stdout (or calls custom alert handlers if supplied).
 *
 * Usage as a module:
 * ```js
 * import { startBot } from './bot.js';
 *
 * const bot = startBot({
 *   queries: ['pepe', 'moon', 'frog'],
 *   intervalMs: 60_000,
 *   onNewPair:    (pair) => myNotifier.send(`🚨 New meme: ${pair.baseToken.symbol}`),
 *   onPriceAlert: (pair) => myNotifier.send(`🔥 Pump: ${pair.baseToken.symbol}`),
 * });
 *
 * // Stop later:
 * bot.stop();
 * ```
 */

import { MemeTracker, Events, DEFAULT_CONFIG } from './memeTracker.js';
import { formatPair } from '../sources/dexscreener.js';

/** Default polling interval: 60 seconds. */
const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Build a colourless, timestamped log prefix.
 *
 * @returns {string}
 */
function timestamp() {
  return `[${new Date().toISOString()}]`;
}

/**
 * Start the XRPL meme tracker bot.
 *
 * @param {object} [options]
 * @param {string[]} [options.queries]           Search terms to monitor
 * @param {number}  [options.intervalMs]         Polling interval in milliseconds
 * @param {object}  [options.meme]               Meme heuristic config (forwarded to MemeTracker)
 * @param {number}  [options.priceAlertThresholdPct]
 * @param {number}  [options.minVolumeUsd]
 * @param {Function} [options.onNewPair]         Custom handler for new-pair events
 * @param {Function} [options.onPriceAlert]      Custom handler for price-alert events
 * @param {Function} [options.onVolumeAlert]     Custom handler for volume-alert events
 * @param {Function} [options.onPollComplete]    Called after each poll with the full pair list
 * @param {boolean}  [options.silent]            Suppress default stdout logging
 *
 * @returns {{ stop: Function, tracker: MemeTracker }} Bot handle
 */
export function startBot(options = {}) {
  const {
    queries = DEFAULT_CONFIG.queries,
    intervalMs = DEFAULT_INTERVAL_MS,
    meme = DEFAULT_CONFIG.meme,
    priceAlertThresholdPct = DEFAULT_CONFIG.priceAlertThresholdPct,
    minVolumeUsd = DEFAULT_CONFIG.minVolumeUsd,
    onNewPair,
    onPriceAlert,
    onVolumeAlert,
    onPollComplete,
    silent = false,
  } = options;

  const tracker = new MemeTracker({ queries, meme, priceAlertThresholdPct, minVolumeUsd });

  // ------------------------------------------------------------------
  // Register event handlers
  // ------------------------------------------------------------------

  tracker.on(Events.NEW_PAIR, (pair) => {
    if (!silent) {
      console.log(
        `${timestamp()} 🚨 NEW XRPL MEME PAIR DETECTED\n${formatPair(pair)}\n`
      );
    }
    if (typeof onNewPair === 'function') onNewPair(pair);
  });

  tracker.on(Events.PRICE_ALERT, (pair) => {
    const change = pair.priceChange?.h24;
    const sign = change >= 0 ? '+' : '';
    if (!silent) {
      console.log(
        `${timestamp()} 🔥 PRICE ALERT  ${pair.baseToken?.symbol ?? '?'}  ${sign}${change}% (24 h)\n${formatPair(pair)}\n`
      );
    }
    if (typeof onPriceAlert === 'function') onPriceAlert(pair);
  });

  tracker.on(Events.VOLUME_ALERT, (pair) => {
    if (!silent) {
      console.log(
        `${timestamp()} 📈 VOLUME SPIKE  ${pair.baseToken?.symbol ?? '?'}  vol=$${Number(pair.volume?.h24 ?? 0).toLocaleString()}\n${formatPair(pair)}\n`
      );
    }
    if (typeof onVolumeAlert === 'function') onVolumeAlert(pair);
  });

  // ------------------------------------------------------------------
  // Polling loop
  // ------------------------------------------------------------------

  let running = true;

  async function tick() {
    if (!running) return;
    try {
      const pairs = await tracker.poll();
      if (!silent) {
        console.log(
          `${timestamp()} ✅ Poll complete — ${pairs.length} XRPL meme pair(s) found (tracking ${tracker.trackedCount} total)`
        );
      }
      if (typeof onPollComplete === 'function') onPollComplete(pairs);
    } catch (err) {
      if (!silent) {
        console.error(`${timestamp()} ❌ Poll error: ${err.message}`);
      }
    }
  }

  // Run immediately, then on interval.
  tick();
  const timer = setInterval(tick, intervalMs);

  if (!silent) {
    console.log(
      `${timestamp()} 🤖 XRPL Meme Tracker Bot started — polling every ${intervalMs / 1000}s`
    );
    console.log(`   Watching queries: ${queries.join(', ')}\n`);
  }

  return {
    /** Stop the bot and cancel all future polls. */
    stop() {
      running = false;
      clearInterval(timer);
      if (!silent) console.log(`${timestamp()} 🛑 Bot stopped.`);
    },
    /** Direct access to the underlying tracker (subscribe to extra events, etc.). */
    tracker,
  };
}
