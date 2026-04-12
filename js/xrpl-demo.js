/* ============================================================
   xrpl-demo.js — Live XRPL connection and data feed
   Connects to the XRP Ledger mainnet via the public
   WebSocket endpoint using the xrpl.js library, and
   fetches XRP price from the CoinGecko free API.
   ============================================================ */

'use strict';

/* ── Expose live XRP price globally for the simulator ─────── */
window.LIVE_XRP_PRICE = null;

/* ── Config ──────────────────────────────────────────────── */
var XRPL_WS_URL      = 'wss://xrplcluster.com';
var XRPL_WS_FALLBACK = 'wss://s1.ripple.com';
var COINGECKO_URL    = 'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd&include_24hr_change=true';
var MAX_TX_ITEMS     = 30;  // max items shown in the live feed

/* ── DOM refs ────────────────────────────────────────────── */
var statusDot      = document.getElementById('statusDot');
var statusText     = document.getElementById('statusText');
var txFeed         = document.getElementById('txFeed');
var txCounter      = document.getElementById('txCounter');
var statLedger     = document.getElementById('statLedger');
var statTxCount    = document.getElementById('statTxCount');
var statCloseTime  = document.getElementById('statCloseTime');
var statReserve    = document.getElementById('statReserve');
var statPrice      = document.getElementById('statPrice');
var statFee        = document.getElementById('statFee');
var heroLedger     = document.getElementById('heroLedger');
var heroTps        = document.getElementById('heroTps');
var xrpPriceEl     = document.getElementById('xrpPrice');
var xrpChangeEl    = document.getElementById('xrpChange');
var consensusStage = document.getElementById('consensusStage');

/* ── State ───────────────────────────────────────────────── */
var txTotal    = 0;
var lastLedger = 0;
var prevLedgerCloseTime = 0;
var xrplClient = null;

/* ── Helpers ─────────────────────────────────────────────── */
function setStatus(state, text) {
  if (!statusDot || !statusText) return;
  statusDot.className = 'status-dot ' + state;
  statusText.textContent = text;
}

function fmt(n) {
  return n != null ? n.toLocaleString() : '–';
}

function shortenHash(hash) {
  if (!hash) return '–';
  return hash.slice(0, 8) + '…' + hash.slice(-6);
}

function xrpFromDrops(drops) {
  var n = parseInt(drops, 10);
  if (isNaN(n)) return null;
  return n / 1e6;
}

function formatXRP(drops) {
  var xrp = xrpFromDrops(drops);
  if (xrp === null) return '';
  if (xrp >= 1e9) return (xrp / 1e9).toFixed(2) + 'B XRP';
  if (xrp >= 1e6) return (xrp / 1e6).toFixed(2) + 'M XRP';
  if (xrp >= 1e3) return xrp.toFixed(2) + ' XRP';
  return xrp.toFixed(6) + ' XRP';
}

function getTxTypeClass(type) {
  var map = {
    'Payment': 'tx-Payment',
    'OfferCreate': 'tx-OfferCreate',
    'OfferCancel': 'tx-OfferCreate',
    'TrustSet': 'tx-TrustSet',
    'EscrowCreate': 'tx-EscrowCreate',
    'EscrowFinish': 'tx-EscrowCreate',
    'NFTokenMint': 'tx-NFTokenMint',
    'NFTokenBurn': 'tx-NFTokenMint',
    'NFTokenCreateOffer': 'tx-NFTokenMint',
    'NFTokenAcceptOffer': 'tx-NFTokenMint',
  };
  return map[type] || 'tx-other';
}

function getAmountStr(tx) {
  if (!tx) return '';
  var txType = tx.TransactionType || tx.transaction_type || '';

  // Payment
  if (txType === 'Payment') {
    var amt = tx.Amount || tx.amount;
    if (typeof amt === 'string') {
      return formatXRP(amt);
    } else if (amt && typeof amt === 'object') {
      return parseFloat(amt.value).toFixed(4) + ' ' + amt.currency;
    }
  }

  // OfferCreate
  if (txType === 'OfferCreate') {
    var takerPays = tx.TakerPays || tx.taker_pays;
    if (typeof takerPays === 'string') return formatXRP(takerPays);
    if (takerPays && typeof takerPays === 'object') {
      return parseFloat(takerPays.value).toFixed(2) + ' ' + takerPays.currency;
    }
  }

  return '';
}

/* ── Add transaction to feed ─────────────────────────────── */
function addTxToFeed(tx) {
  if (!txFeed) return;

  // Remove placeholder if present
  var placeholder = txFeed.querySelector('[data-placeholder]');
  if (placeholder) placeholder.remove();

  txTotal++;
  if (txCounter) txCounter.textContent = txTotal.toLocaleString() + ' transactions';

  var txType  = (tx.TransactionType || tx.transaction_type || 'Unknown');
  var hash    = (tx.hash || tx.Hash || '');
  var amtStr  = getAmountStr(tx);

  var item = document.createElement('div');
  item.className = 'tx-item';
  item.innerHTML =
    '<span class="tx-type-badge ' + getTxTypeClass(txType) + '">' + txType + '</span>' +
    '<span class="tx-hash">' + shortenHash(hash) + '</span>' +
    (amtStr ? '<span class="tx-amount">' + amtStr + '</span>' : '');

  txFeed.insertBefore(item, txFeed.firstChild);

  // Trim feed to max items
  while (txFeed.children.length > MAX_TX_ITEMS) {
    txFeed.removeChild(txFeed.lastChild);
  }
}

/* ── Update ledger stats ─────────────────────────────────── */
function updateLedgerStats(ledger) {
  var idx      = ledger.ledger_index || ledger.ledger_hash;
  var txCount  = ledger.txn_count || 0;
  var closeEpoch = ledger.close_time; // XRPL epoch (seconds since 2000-01-01)

  var closeInterval = 0;
  if (prevLedgerCloseTime && closeEpoch) {
    closeInterval = closeEpoch - prevLedgerCloseTime;
  }
  if (closeEpoch) prevLedgerCloseTime = closeEpoch;

  if (statLedger)    statLedger.textContent    = fmt(idx);
  if (statTxCount)   statTxCount.textContent   = fmt(txCount);
  if (statCloseTime) {
    statCloseTime.innerHTML = (closeInterval > 0
      ? closeInterval.toFixed(1)
      : '~4') + '<span class="unit">s</span>';
  }

  if (heroLedger) heroLedger.textContent = fmt(idx);
  if (heroTps)    heroTps.textContent    = fmt(txCount);

  // Animate consensus stage based on ledger close
  if (consensusStage) {
    consensusStage.textContent = '✅ Ledger #' + fmt(idx) + ' closed — ' + fmt(txCount) + ' transactions';
    consensusStage.style.color = 'var(--green)';
    setTimeout(function () {
      if (consensusStage) {
        consensusStage.textContent = '🔄 Round ' + fmt((idx || 0) + 1) + ' — broadcasting proposals…';
        consensusStage.style.color = '';
      }
    }, 2000);
  }
}

/* ── Fetch XRP price from CoinGecko free API ─────────────── */
function fetchXrpPrice() {
  fetch(COINGECKO_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var price  = data && data.ripple && data.ripple.usd;
      var change = data && data.ripple && data.ripple.usd_24h_change;

      if (price == null) return;

      window.LIVE_XRP_PRICE = price;

      var priceStr = '$' + price.toFixed(4);
      if (xrpPriceEl) xrpPriceEl.textContent = priceStr;
      if (statPrice)  statPrice.textContent  = priceStr;

      if (xrpChangeEl && change != null) {
        var sign = change >= 0 ? '+' : '';
        xrpChangeEl.textContent = sign + change.toFixed(2) + '% (24h)';
        xrpChangeEl.className   = 'xrp-price-change ' + (change >= 0 ? 'positive' : 'negative');
      }
    })
    .catch(function (err) {
      console.warn('[XRP Africa] CoinGecko price fetch failed:', err.message);
      // Fallback: use a static price
      if (!window.LIVE_XRP_PRICE) {
        window.LIVE_XRP_PRICE = 0.55;
        if (xrpPriceEl) xrpPriceEl.textContent = 'Unavailable';
        if (xrpChangeEl) xrpChangeEl.textContent = 'Price data offline';
        if (statPrice)  statPrice.textContent  = '–';
      }
    });
}

/* ── Fetch server_info to get base reserve / base fee ─────── */
function fetchServerInfo(client) {
  client.request({ command: 'server_info' })
    .then(function (res) {
      var info = res && res.result && res.result.info;
      if (!info) return;

      // Base fee in drops
      var feeDrops = info.validated_ledger && info.validated_ledger.base_fee_xrp;
      if (feeDrops != null && statFee) {
        var drops = Math.round(feeDrops * 1e6);
        statFee.innerHTML = drops + '<span class="unit"> drops</span>';
      }

      // Reserve
      var reserveXRP = info.validated_ledger && info.validated_ledger.reserve_base_xrp;
      if (reserveXRP != null && statReserve) {
        statReserve.innerHTML = reserveXRP + '<span class="unit">XRP</span>';
      }
    })
    .catch(function (err) {
      console.warn('[XRP Africa] server_info failed:', err.message);
    });
}

/* ── Connect to XRPL and subscribe ──────────────────────── */
function connectToXRPL(wsUrl) {
  setStatus('connecting', 'Connecting…');

  // xrpl.js exposes either window.xrpl or xrpl depending on bundler
  var lib = (typeof window !== 'undefined' && window.xrpl) ? window.xrpl : (typeof xrpl !== 'undefined' ? xrpl : null);

  if (!lib) {
    setStatus('error', 'xrpl.js not loaded');
    showFeedError('Could not load xrpl.js library. Please check your connection.');
    return;
  }

  var client = new lib.Client(wsUrl);
  xrplClient = client;

  client.on('connected', function () {
    setStatus('connected', 'Connected to Mainnet');

    // Subscribe to ledger and transaction streams
    client.request({
      command: 'subscribe',
      streams: ['ledger', 'transactions'],
    }).catch(function (err) {
      console.warn('[XRP Africa] subscribe error:', err.message);
    });

    fetchServerInfo(client);
  });

  client.on('ledgerClosed', function (ledger) {
    updateLedgerStats(ledger);
  });

  client.on('transaction', function (data) {
    var tx = data.transaction || data.tx_json || data;
    addTxToFeed(tx);
  });

  client.on('disconnected', function (code) {
    setStatus('error', 'Disconnected (' + code + ')');
    console.warn('[XRP Africa] WebSocket disconnected, code=' + code);

    // Attempt reconnect after 5 seconds
    setTimeout(function () {
      if (wsUrl === XRPL_WS_URL) {
        connectToXRPL(XRPL_WS_FALLBACK);
      } else {
        connectToXRPL(XRPL_WS_URL);
      }
    }, 5000);
  });

  client.on('error', function (err) {
    console.error('[XRP Africa] XRPL client error:', err);
    setStatus('error', 'Connection error');
  });

  client.connect().catch(function (err) {
    console.error('[XRP Africa] connect failed:', err.message);
    setStatus('error', 'Connection failed');
    showFeedError('Could not connect to the XRP Ledger. Retrying in 5s…');

    setTimeout(function () {
      var fallback = wsUrl === XRPL_WS_URL ? XRPL_WS_FALLBACK : XRPL_WS_URL;
      connectToXRPL(fallback);
    }, 5000);
  });
}

function showFeedError(msg) {
  if (!txFeed) return;
  txFeed.innerHTML = '<div data-placeholder style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.85rem;">'
    + '⚠️ ' + msg + '</div>';
}

/* ── Initialise ──────────────────────────────────────────── */
(function init() {
  // Wait for DOM + xrpl.js to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  function start() {
    // Fetch price immediately and then every 60 seconds
    fetchXrpPrice();
    setInterval(fetchXrpPrice, 60000);

    // Connect to XRPL WebSocket
    // Wrap in a small timeout so xrpl.js (loaded via unpkg) has time to parse
    setTimeout(function () {
      connectToXRPL(XRPL_WS_URL);
    }, 300);
  }
})();
