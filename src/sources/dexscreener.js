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

/**
 * Format a pair object into a human-readable summary string.
 *
 * @param {object} pair - A pair object returned by the DexScreener API
 * @returns {string} Formatted summary
 */
export function formatPair(pair) {
  const base = pair.baseToken?.symbol ?? '?';
  const quote = pair.quoteToken?.symbol ?? '?';
  const price = pair.priceUsd != null ? `$${Number(pair.priceUsd).toFixed(6)}` : 'N/A';
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
