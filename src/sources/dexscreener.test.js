/**
 * Unit tests for the DexScreener source module.
 *
 * Run with: node --test src/sources/dexscreener.test.js
 */

import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// We patch global.fetch before importing so that tests never hit the network.
const originalFetch = globalThis.fetch;

function mockFetch(responseBody, status = 200) {
  globalThis.fetch = async (_url, _opts) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => responseBody,
  });
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Dynamic import so we get the module after patching fetch.
// We re-import inside each describe block to keep isolation.
const {
  searchPairs,
  getTokenPairs,
  getPair,
  getLatestTokenProfiles,
  getTopBoostedTokens,
  formatPair,
} = await import('./dexscreener.js');

describe('searchPairs', () => {
  beforeEach(() => mockFetch({ pairs: [{ baseToken: { symbol: 'ETH' }, quoteToken: { symbol: 'USDC' } }] }));
  afterEach(restoreFetch);

  it('returns an array of pairs', async () => {
    const result = await searchPairs('ETH');
    assert.ok(Array.isArray(result), 'result should be an array');
    assert.equal(result.length, 1);
    assert.equal(result[0].baseToken.symbol, 'ETH');
  });

  it('throws when query is empty', async () => {
    await assert.rejects(() => searchPairs(''), TypeError);
  });

  it('throws when query is not a string', async () => {
    await assert.rejects(() => searchPairs(null), TypeError);
  });

  it('returns empty array when API returns no pairs', async () => {
    mockFetch({ pairs: [] });
    const result = await searchPairs('NONEXISTENT_TOKEN_XYZ');
    assert.deepEqual(result, []);
  });

  it('returns empty array when pairs key is missing from response', async () => {
    mockFetch({});
    const result = await searchPairs('ETH');
    assert.deepEqual(result, []);
  });
});

describe('getTokenPairs', () => {
  beforeEach(() => mockFetch({ pairs: [{ pairAddress: '0xabc' }] }));
  afterEach(restoreFetch);

  it('accepts a single address string', async () => {
    const result = await getTokenPairs('0xabc');
    assert.equal(result.length, 1);
  });

  it('accepts an array of addresses', async () => {
    const result = await getTokenPairs(['0xabc', '0xdef']);
    assert.equal(result.length, 1);
  });

  it('throws for empty array', async () => {
    await assert.rejects(() => getTokenPairs([]), TypeError);
  });

  it('throws when more than 30 addresses supplied', async () => {
    const addresses = Array.from({ length: 31 }, (_, i) => `0x${i}`);
    await assert.rejects(() => getTokenPairs(addresses), RangeError);
  });
});

describe('getPair', () => {
  afterEach(restoreFetch);

  it('returns the first pair when found', async () => {
    mockFetch({ pairs: [{ pairAddress: '0xpair', chainId: 'ethereum' }] });
    const pair = await getPair('ethereum', '0xpair');
    assert.equal(pair.pairAddress, '0xpair');
  });

  it('returns null when pairs array is empty', async () => {
    mockFetch({ pairs: [] });
    const pair = await getPair('ethereum', '0xunknown');
    assert.equal(pair, null);
  });

  it('throws when chainId is missing', async () => {
    await assert.rejects(() => getPair('', '0xpair'), TypeError);
  });

  it('throws when pairAddress is missing', async () => {
    await assert.rejects(() => getPair('ethereum', ''), TypeError);
  });
});

describe('getLatestTokenProfiles', () => {
  afterEach(restoreFetch);

  it('returns array from API', async () => {
    mockFetch([{ tokenAddress: '0xabc', chainId: 'ethereum' }]);
    const result = await getLatestTokenProfiles();
    assert.ok(Array.isArray(result));
    assert.equal(result[0].tokenAddress, '0xabc');
  });

  it('returns empty array for non-array response', async () => {
    mockFetch({ error: 'unexpected' });
    const result = await getLatestTokenProfiles();
    assert.deepEqual(result, []);
  });
});

describe('getTopBoostedTokens', () => {
  afterEach(restoreFetch);

  it('returns array from API', async () => {
    mockFetch([{ tokenAddress: '0xboosted', totalAmount: 1000 }]);
    const result = await getTopBoostedTokens();
    assert.equal(result.length, 1);
    assert.equal(result[0].totalAmount, 1000);
  });
});

describe('formatPair', () => {
  const samplePair = {
    baseToken: { symbol: 'WETH' },
    quoteToken: { symbol: 'USDC' },
    dexId: 'uniswap',
    chainId: 'ethereum',
    priceUsd: '2500.123456',
    priceChange: { h24: 1.5 },
    liquidity: { usd: 5000000 },
    volume: { h24: 800000 },
    pairAddress: '0xpairaddress',
  };

  it('includes base/quote symbols', () => {
    const text = formatPair(samplePair);
    assert.ok(text.includes('WETH/USDC'));
  });

  it('includes price', () => {
    const text = formatPair(samplePair);
    assert.ok(text.includes('2500.123456'));
  });

  it('includes 24h change with sign', () => {
    const text = formatPair(samplePair);
    assert.ok(text.includes('+1.5%'));
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = { baseToken: { symbol: 'A' }, quoteToken: { symbol: 'B' } };
    const text = formatPair(minimal);
    assert.ok(text.includes('A/B'));
    assert.ok(text.includes('N/A'));
  });

  it('shows negative change without extra plus sign', () => {
    const pair = { ...samplePair, priceChange: { h24: -3.2 } };
    const text = formatPair(pair);
    assert.ok(text.includes('-3.2%'));
    assert.ok(!text.includes('+-'));
  });
});
