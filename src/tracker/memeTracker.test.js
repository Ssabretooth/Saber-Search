/**
 * Unit tests for XRPL meme tracker modules.
 *
 * Run with: node --test src/tracker/memeTracker.test.js
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Shared mock-fetch helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockFetch(body, status = 200) {
  globalThis.fetch = async () => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  });
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

// Sample XRPL pairs used across multiple test suites.
const xrplMemePair = {
  pairAddress: '0xmeme1',
  chainId: 'xrpl',
  dexId: 'xrpldex',
  baseToken: { symbol: 'PEPE', name: 'Pepe Coin' },
  quoteToken: { symbol: 'XRP' },
  priceUsd: '0.000001',
  priceChange: { h24: 120 },
  liquidity: { usd: 50_000 },
  volume: { h24: 20_000 },
  pairCreatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5, // 5 days ago
};

const nonXrplPair = {
  pairAddress: '0xeth1',
  chainId: 'ethereum',
  baseToken: { symbol: 'ETH' },
  quoteToken: { symbol: 'USDC' },
  priceChange: { h24: 150 },
  liquidity: { usd: 10_000 },
  volume: { h24: 5_000 },
};

const lowVolumePair = {
  ...xrplMemePair,
  pairAddress: '0xmeme2',
  volume: { h24: 50 }, // below minVolumeUsd
};

// ---------------------------------------------------------------------------
// Tests for XRPL helpers in dexscreener.js
// ---------------------------------------------------------------------------

const { searchXrplPairs, getXrplTokenPairs, isXrplMemePair, searchXrplMemePairs } =
  await import('../sources/dexscreener.js');

describe('searchXrplPairs', () => {
  afterEach(restoreFetch);

  it('returns only xrpl-chain pairs', async () => {
    mockFetch({ pairs: [xrplMemePair, nonXrplPair] });
    const result = await searchXrplPairs('pepe');
    assert.equal(result.length, 1);
    assert.equal(result[0].chainId, 'xrpl');
  });

  it('returns empty array when no xrpl pairs match', async () => {
    mockFetch({ pairs: [nonXrplPair] });
    const result = await searchXrplPairs('ETH');
    assert.deepEqual(result, []);
  });
});

describe('getXrplTokenPairs', () => {
  afterEach(restoreFetch);

  it('filters to xrpl chain only', async () => {
    mockFetch({ pairs: [xrplMemePair, nonXrplPair] });
    const result = await getXrplTokenPairs('rSomeIssuer');
    assert.equal(result.length, 1);
    assert.equal(result[0].pairAddress, '0xmeme1');
  });
});

describe('isXrplMemePair', () => {
  it('returns true for a valid XRPL meme pair', () => {
    assert.ok(isXrplMemePair(xrplMemePair));
  });

  it('returns false for a non-XRPL pair', () => {
    assert.ok(!isXrplMemePair(nonXrplPair));
  });

  it('returns false when liquidity exceeds threshold', () => {
    const pair = { ...xrplMemePair, liquidity: { usd: 1_000_000 } };
    assert.ok(!isXrplMemePair(pair));
  });

  it('returns false when pair is too old', () => {
    const pair = {
      ...xrplMemePair,
      pairCreatedAt: Date.now() - 1000 * 60 * 60 * 24 * 60, // 60 days ago
    };
    assert.ok(!isXrplMemePair(pair));
  });

  it('returns false when 24h change is below threshold', () => {
    const pair = { ...xrplMemePair, priceChange: { h24: 5 } };
    assert.ok(!isXrplMemePair(pair));
  });

  it('respects custom options', () => {
    // With very loose settings, the non-XRPL pair still fails because chainId != xrpl.
    assert.ok(!isXrplMemePair(nonXrplPair, { maxLiquidityUsd: 1e9, maxAgeDays: 9999, minChange24hPct: 0 }));

    // With loose settings an XRPL pair with low change should still pass.
    const lowChange = { ...xrplMemePair, priceChange: { h24: 2 } };
    assert.ok(isXrplMemePair(lowChange, { minChange24hPct: 0 }));
  });
});

describe('searchXrplMemePairs', () => {
  afterEach(restoreFetch);

  it('returns only meme-like xrpl pairs', async () => {
    mockFetch({ pairs: [xrplMemePair, nonXrplPair] });
    const result = await searchXrplMemePairs('pepe');
    assert.equal(result.length, 1);
    assert.equal(result[0].pairAddress, '0xmeme1');
  });

  it('returns empty array when no meme pairs found', async () => {
    // Large liquidity → not a meme pair
    const bigPair = { ...xrplMemePair, liquidity: { usd: 10_000_000 } };
    mockFetch({ pairs: [bigPair] });
    const result = await searchXrplMemePairs('bigtoken');
    assert.deepEqual(result, []);
  });
});

// ---------------------------------------------------------------------------
// Tests for MemeTracker
// ---------------------------------------------------------------------------

const { MemeTracker, Events, DEFAULT_CONFIG } = await import('./memeTracker.js');

describe('MemeTracker', () => {
  afterEach(restoreFetch);

  it('emits NEW_PAIR for first-seen meme pairs', async () => {
    mockFetch({ pairs: [xrplMemePair] });

    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    const newPairs = [];
    tracker.on(Events.NEW_PAIR, (p) => newPairs.push(p));

    await tracker.poll();
    assert.equal(newPairs.length, 1);
    assert.equal(newPairs[0].pairAddress, '0xmeme1');
  });

  it('does NOT emit NEW_PAIR again for a pair seen on a second tick', async () => {
    mockFetch({ pairs: [xrplMemePair] });

    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    const newPairs = [];
    tracker.on(Events.NEW_PAIR, (p) => newPairs.push(p));

    await tracker.poll();
    await tracker.poll(); // second tick with same pair
    assert.equal(newPairs.length, 1); // still only 1 NEW_PAIR
  });

  it('emits PRICE_ALERT when change exceeds threshold', async () => {
    // First tick — register the pair.
    mockFetch({ pairs: [xrplMemePair] });
    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000, priceAlertThresholdPct: 50 });
    await tracker.poll();

    // Second tick — price still above threshold (120%).
    const priceAlerts = [];
    tracker.on(Events.PRICE_ALERT, (p) => priceAlerts.push(p));
    await tracker.poll();
    assert.equal(priceAlerts.length, 1);
  });

  it('does NOT emit PRICE_ALERT when change is below threshold', async () => {
    const mildPair = { ...xrplMemePair, priceChange: { h24: 15 } };
    mockFetch({ pairs: [mildPair] });

    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000, priceAlertThresholdPct: 50 });
    await tracker.poll(); // register

    const priceAlerts = [];
    tracker.on(Events.PRICE_ALERT, (p) => priceAlerts.push(p));
    await tracker.poll();
    assert.equal(priceAlerts.length, 0);
  });

  it('filters out low-volume pairs', async () => {
    mockFetch({ pairs: [lowVolumePair] });
    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    const newPairs = [];
    tracker.on(Events.NEW_PAIR, (p) => newPairs.push(p));
    await tracker.poll();
    assert.equal(newPairs.length, 0);
  });

  it('removes pairs that disappear from results', async () => {
    mockFetch({ pairs: [xrplMemePair] });
    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    await tracker.poll();
    assert.equal(tracker.trackedCount, 1);

    mockFetch({ pairs: [] });
    await tracker.poll();
    assert.equal(tracker.trackedCount, 0);
  });

  it('reset() clears all tracked pairs', async () => {
    mockFetch({ pairs: [xrplMemePair] });
    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    await tracker.poll();
    assert.equal(tracker.trackedCount, 1);
    tracker.reset();
    assert.equal(tracker.trackedCount, 0);
  });

  it('handles handler errors without crashing', async () => {
    mockFetch({ pairs: [xrplMemePair] });
    const tracker = new MemeTracker({ queries: ['pepe'], minVolumeUsd: 1_000 });
    tracker.on(Events.NEW_PAIR, () => { throw new Error('bad handler'); });
    // Should NOT throw
    await assert.doesNotReject(() => tracker.poll());
  });

  it('DEFAULT_CONFIG contains expected keys', () => {
    assert.ok(Array.isArray(DEFAULT_CONFIG.queries));
    assert.ok(DEFAULT_CONFIG.queries.length > 0);
    assert.ok(typeof DEFAULT_CONFIG.meme.maxLiquidityUsd === 'number');
  });
});
