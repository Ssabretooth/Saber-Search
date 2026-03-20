/**
 * Saber-Search — main entry point
 *
 * CLI usage:
 *   node src/index.js search <query>
 *   node src/index.js token <address> [chainId]
 *   node src/index.js pair <chainId> <pairAddress>
 *   node src/index.js trending
 */

import { searchPairs, getTokenPairs, getPair, getTopBoostedTokens, formatPair } from './sources/dexscreener.js';

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

    default:
      console.log([
        'Saber-Search — DeFi search powered by DexScreener',
        '',
        'Commands:',
        '  search <query>              Search for trading pairs by token name, symbol, or address',
        '  token <address>             Get all pairs for a token address',
        '  pair <chainId> <address>    Get details for a specific pair',
        '  trending                    Show top boosted tokens on DexScreener',
        '',
        'Examples:',
        '  node src/index.js search ETH',
        '  node src/index.js token 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        '  node src/index.js pair ethereum 0x11b815efB8f581194ae79006d24E0d814B7697F6',
        '  node src/index.js trending',
      ].join('\n'));
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
