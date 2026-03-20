/**
 * DexScreener API source for Saber-Search
 *
 * Provides integration with the DexScreener public REST API to search
 * DEX trading pairs, retrieve token data, and fetch pair details.
 *
 * API base URL: https://api.dexscreener.com
 * Rate limits:
 *   - DEX/pair search endpoints: 300 requests per minute
 *   - Token profile / boost endpoints: 60 requests per minute
 */

const BASE_URL = 'https://api.dexscreener.com';

/**
 * Fetch JSON from a DexScreener API endpoint.
 *
 * @param {string} path - API path (e.g. "/latest/dex/search?q=ETH")
 * @returns {Promise<object>} Parsed JSON response
 */
async function fetchDexScreener(path) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `DexScreener API error: ${response.status} ${response.statusText} for ${url}`
    );
  }

  return response.json();
}

/**
 * Search DexScreener for trading pairs matching a query.
 *
 * @param {string} query - Token symbol, name, or address to search for
 * @returns {Promise<Array>} Array of matching pair objects
 */
export async function searchPairs(query) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new TypeError('query must be a non-empty string');
  }

  const data = await fetchDexScreener(
    `/latest/dex/search?q=${encodeURIComponent(query.trim())}`
  );
  return data.pairs ?? [];
}

/**
 * Get pairs for one or more token addresses.
 *
 * @param {string|string[]} tokenAddresses - A token address or array of addresses (up to 30)
 * @returns {Promise<Array>} Array of pair objects for the given tokens
 */
export async function getTokenPairs(tokenAddresses) {
  const addresses = Array.isArray(tokenAddresses)
    ? tokenAddresses
    : [tokenAddresses];

  if (addresses.length === 0) {
    throw new TypeError('at least one token address is required');
  }
  if (addresses.length > 30) {
    throw new RangeError('a maximum of 30 token addresses can be queried at once');
  }

  const joined = addresses.map((a) => a.trim()).join(',');
  const data = await fetchDexScreener(`/latest/dex/tokens/${joined}`);
  return data.pairs ?? [];
}

/**
 * Get details for a specific trading pair.
 *
 * @param {string} chainId - Chain identifier (e.g. "ethereum", "solana", "bsc")
 * @param {string} pairAddress - The pair contract address
 * @returns {Promise<object|null>} Pair object, or null if not found
 */
export async function getPair(chainId, pairAddress) {
  if (!chainId || !pairAddress) {
    throw new TypeError('chainId and pairAddress are required');
  }

  const data = await fetchDexScreener(
    `/latest/dex/pairs/${encodeURIComponent(chainId)}/${encodeURIComponent(pairAddress)}`
  );
  const pairs = data.pairs ?? [];
  return pairs.length > 0 ? pairs[0] : null;
}

/**
 * Get the latest token profiles (metadata, icons, links).
 *
 * @returns {Promise<Array>} Array of token profile objects
 */
export async function getLatestTokenProfiles() {
  const data = await fetchDexScreener('/token-profiles/latest/v1');
  return Array.isArray(data) ? data : [];
}

/**
 * Get tokens with the highest active boosts.
 *
 * @returns {Promise<Array>} Array of boosted token objects
 */
export async function getTopBoostedTokens() {
  const data = await fetchDexScreener('/token-boosts/top/v1');
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------------------
// XRPL-specific helpers
// ---------------------------------------------------------------------------

/** The chain identifier used by DexScreener for the XRP Ledger. */
export const XRPL_CHAIN_ID = 'xrpl';

/**
 * Search DexScreener for XRPL trading pairs matching a query.
 *
 * This is a convenience wrapper around {@link searchPairs} that pre-filters
 * results to only pairs on the XRP Ledger.
 *
 * @param {string} query - Token name, symbol, or issuer address
 * @returns {Promise<Array>} XRPL pairs matching the query
 */
export async function searchXrplPairs(query) {
  const pairs = await searchPairs(query);
  return pairs.filter((p) => p.chainId === XRPL_CHAIN_ID);
}

/**
 * Get all known pairs for an XRPL token issuer address.
 *
 * @param {string} issuerAddress - The XRPL issuer account address (r…)
 * @returns {Promise<Array>} Array of XRPL pair objects
 */
export async function getXrplTokenPairs(issuerAddress) {
  const pairs = await getTokenPairs(issuerAddress);
  return pairs.filter((p) => p.chainId === XRPL_CHAIN_ID);
}

/**
 * Determine whether a pair looks like a meme token on the XRPL.
 *
 * Heuristics (all configurable via the `options` argument):
 * - Liquidity < `maxLiquidityUsd`   (meme tokens are usually low-liquidity)
 * - Pair age  < `maxAgeDays`        (recently listed)
 * - 24 h price change magnitude > `minChange24hPct`  (high volatility)
 *
 * @param {object} pair
 * @param {object} [options]
 * @param {number} [options.maxLiquidityUsd=500_000]   Max liquidity in USD
 * @param {number} [options.maxAgeDays=30]             Max listing age in days
 * @param {number} [options.minChange24hPct=10]        Minimum |24 h change| %
 * @returns {boolean}
 */
export function isXrplMemePair(pair, options = {}) {
  const {
    maxLiquidityUsd = 500_000,
    maxAgeDays = 30,
    minChange24hPct = 10,
  } = options;

  if (pair.chainId !== XRPL_CHAIN_ID) return false;

  const liquidity = pair.liquidity?.usd ?? Infinity;
  if (liquidity > maxLiquidityUsd) return false;

  if (pair.pairCreatedAt) {
    const ageMs = Date.now() - pair.pairCreatedAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > maxAgeDays) return false;
  }

  const change24h = Math.abs(pair.priceChange?.h24 ?? 0);
  if (change24h < minChange24hPct) return false;

  return true;
}

/**
 * Fetch and return only XRPL pairs that pass the meme-token heuristics.
 *
 * @param {string} query - Search query forwarded to DexScreener
 * @param {object} [memeOptions] - Options forwarded to {@link isXrplMemePair}
 * @returns {Promise<Array>} Filtered array of meme-like XRPL pairs
 */
export async function searchXrplMemePairs(query, memeOptions = {}) {
  const xrplPairs = await searchXrplPairs(query);
  return xrplPairs.filter((p) => isXrplMemePair(p, memeOptions));
}

// ---------------------------------------------------------------------------

/**
 * Format a price number with adaptive decimal precision.
 *  - Price >= 1 000   → 2 decimal places  (e.g. "$1,234.56")
 *  - Price >= 1       → 4 decimal places  (e.g. "$2.5001")
 *  - Price >= 0.0001  → 6 decimal places  (e.g. "$0.000012")
 *  - Smaller          → up to 10 significant figures (e.g. "$0.0000000012")
 *
 * @param {number} price
 * @returns {string}
 */
function formatPrice(price) {
  if (price >= 1_000) return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1)     return price.toFixed(4);
  if (price >= 0.0001) return price.toFixed(6);
  // Very small values: show up to 10 significant figures to avoid "0.000000"
  return price.toPrecision(4);
}

/**
 * Format a pair object into a human-readable summary string.
 *
 * @param {object} pair - A pair object returned by the DexScreener API
 * @returns {string} Formatted summary
 */
export function formatPair(pair) {
  const base = pair.baseToken?.symbol ?? '?';
  const quote = pair.quoteToken?.symbol ?? '?';
  const price = pair.priceUsd != null ? `$${formatPrice(Number(pair.priceUsd))}` : 'N/A';
  const liquidity = pair.liquidity?.usd != null
    ? `$${Number(pair.liquidity.usd).toLocaleString()}`
    : 'N/A';
  const volume24h = pair.volume?.h24 != null
    ? `$${Number(pair.volume.h24).toLocaleString()}`
    : 'N/A';
  const change24h = pair.priceChange?.h24 != null
    ? `${pair.priceChange.h24 >= 0 ? '+' : ''}${pair.priceChange.h24}%`
    : 'N/A';

  return [
    `${base}/${quote} on ${pair.dexId ?? 'Unknown DEX'} (${pair.chainId ?? 'unknown chain'})`,
    `  Price:      ${price}`,
    `  24h Change: ${change24h}`,
    `  Liquidity:  ${liquidity}`,
    `  24h Volume: ${volume24h}`,
    `  Pair:       ${pair.pairAddress ?? 'N/A'}`,
  ].join('\n');
}
