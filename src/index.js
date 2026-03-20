/**
 * Saber-Search — main entry point
 *
 * CLI usage:
 *   node src/index.js search <query>
 *   node src/index.js token <address>
 *   node src/index.js pair <chainId> <pairAddress>
 *   node src/index.js trending
 *   node src/index.js xrpl <query>
 *   node src/index.js track [query1,query2,...] [intervalSeconds]
 */

import { searchPairs, getTokenPairs, getPair, getTopBoostedTokens, formatPair, searchXrplPairs, getXrplTokenPairs } from './sources/dexscreener.js';
import { startBot } from './tracker/bot.js';

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'search': {
      const query = args.join(' ');
      if (!query) {
        console.error('Usage: saber-search search <query>');
        process.exit(1);
      }
      console.log(`Searching DexScreener for: "${query}" …\n`);
      const pairs = await searchPairs(query);
      if (pairs.length === 0) {
        console.log('No pairs found.');
      } else {
        console.log(`Found ${pairs.length} pair(s):\n`);
        pairs.slice(0, 10).forEach((pair, i) => {
          console.log(`[${i + 1}] ${formatPair(pair)}\n`);
        });
      }
      break;
    }

    case 'token': {
      const [address] = args;
      if (!address) {
        console.error('Usage: saber-search token <tokenAddress>');
        process.exit(1);
      }
      console.log(`Fetching pairs for token: ${address} …\n`);
      const pairs = await getTokenPairs(address);
      if (pairs.length === 0) {
        console.log('No pairs found for this token.');
      } else {
        console.log(`Found ${pairs.length} pair(s):\n`);
        pairs.slice(0, 10).forEach((pair, i) => {
          console.log(`[${i + 1}] ${formatPair(pair)}\n`);
        });
      }
      break;
    }

    case 'pair': {
      const [chainId, pairAddress] = args;
      if (!chainId || !pairAddress) {
        console.error('Usage: saber-search pair <chainId> <pairAddress>');
        process.exit(1);
      }
      console.log(`Fetching pair ${pairAddress} on ${chainId} …\n`);
      const pair = await getPair(chainId, pairAddress);
      if (!pair) {
        console.log('Pair not found.');
      } else {
        console.log(formatPair(pair));
      }
      break;
    }

    case 'trending': {
      console.log('Fetching top boosted tokens from DexScreener …\n');
      const tokens = await getTopBoostedTokens();
      if (tokens.length === 0) {
        console.log('No boosted tokens found.');
      } else {
        console.log(`Top ${Math.min(tokens.length, 10)} boosted token(s):\n`);
        tokens.slice(0, 10).forEach((token, i) => {
          const name = token.tokenAddress ?? 'Unknown';
          const chain = token.chainId ?? 'unknown';
          const amount = token.totalAmount ?? token.amount ?? 'N/A';
          console.log(`[${i + 1}] ${name} (${chain}) — boost: ${amount}`);
        });
      }
      break;
    }

    // ------------------------------------------------------------------
    // XRPL-specific commands
    // ------------------------------------------------------------------

    case 'xrpl': {
      const query = args.join(' ');
      if (!query) {
        console.error('Usage: saber-search xrpl <query>');
        process.exit(1);
      }
      console.log(`Searching DexScreener for XRPL pairs matching: "${query}" …\n`);
      const pairs = await searchXrplPairs(query);
      if (pairs.length === 0) {
        console.log('No XRPL pairs found.');
      } else {
        console.log(`Found ${pairs.length} XRPL pair(s):\n`);
        pairs.slice(0, 10).forEach((pair, i) => {
          console.log(`[${i + 1}] ${formatPair(pair)}\n`);
        });
      }
      break;
    }

    case 'track': {
      // Usage: track [comma-separated queries] [intervalSeconds]
      // e.g.:  track pepe,moon,frog 30
      const queriesArg = args[0];
      const intervalArg = args[1];

      const queries = queriesArg
        ? queriesArg.split(',').map((q) => q.trim()).filter(Boolean)
        : undefined;

      const intervalMs = intervalArg
        ? Number(intervalArg) * 1000
        : 60_000;

      if (isNaN(intervalMs) || intervalMs < 5_000) {
        console.error('Interval must be a number >= 5 seconds.');
        process.exit(1);
      }

      console.log('Starting XRPL Meme Tracker Bot. Press Ctrl+C to stop.\n');

      const bot = startBot({ queries, intervalMs });

      // Graceful shutdown on Ctrl+C.
      process.on('SIGINT', () => {
        bot.stop();
        process.exit(0);
      });

      // Keep the process alive.
      await new Promise(() => {});
      break;
    }

    default:
      console.log([
        'Saber-Search — DeFi search powered by DexScreener',
        '',
        'Commands:',
        '  search <query>                    Search all chains for trading pairs',
        '  token <address>                   Get all pairs for a token address',
        '  pair <chainId> <address>          Get details for a specific pair',
        '  trending                          Show top boosted tokens on DexScreener',
        '  xrpl <query>                      Search XRPL-only trading pairs',
        '  track [queries] [intervalSecs]    Start the XRPL meme tracker bot',
        '',
        'Examples:',
        '  node src/index.js search ETH',
        '  node src/index.js xrpl pepe',
        '  node src/index.js token rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
        '  node src/index.js pair xrpl <pairAddress>',
        '  node src/index.js track pepe,moon,frog 60',
        '  node src/index.js trending',
      ].join('\n'));
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

