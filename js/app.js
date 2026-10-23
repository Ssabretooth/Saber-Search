/* ============================================================
   app.js — General interactivity: nav, scroll animations,
   use-case tabs, accordion, consensus visualiser, simulator
   ============================================================ */

'use strict';

/* ── Navbar scroll behaviour ─────────────────────────────── */
(function initNav() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  hamburger.addEventListener('click', function () {
    navLinks.classList.toggle('open');
  });

  // Close mobile menu on link click
  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
    });
  });
})();

/* ── Intersection Observer – fade-up animations ──────────── */
(function initScrollAnimations() {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(function (el) {
    observer.observe(el);
  });
})();

/* ── Use-Case Tabs ───────────────────────────────────────── */
(function initTabs() {
  var tabBtns   = document.querySelectorAll('.tab-btn');
  var tabPanels = document.querySelectorAll('.use-case-panel');

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panelId = btn.getAttribute('data-panel');

      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });

      btn.classList.add('active');
      var panel = document.getElementById('panel-' + panelId);
      if (panel) panel.classList.add('active');
    });
  });
})();

/* ── Accordion ───────────────────────────────────────────── */
(function initAccordion() {
  document.querySelectorAll('.accordion-toggle').forEach(function (toggle) {
    toggle.addEventListener('click', function () {
      var item = toggle.closest('.accordion-item');
      var body = item.querySelector('.accordion-body');
      var inner = item.querySelector('.accordion-body-inner');
      var isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.accordion-item').forEach(function (ai) {
        ai.classList.remove('open');
        ai.querySelector('.accordion-body').style.maxHeight = '0';
      });

      // Open clicked (unless it was already open)
      if (!isOpen) {
        item.classList.add('open');
        body.style.maxHeight = (inner.scrollHeight + 24) + 'px';
      }
    });
  });
})();

/* ── Consensus Visualiser ────────────────────────────────── */
(function initConsensusViz() {
  var nodes = document.querySelectorAll('.validator-node');
  var stage = document.getElementById('consensusStage');
  if (!nodes.length || !stage) return;

  var stages = [
    { label: '📡 Broadcasting candidate transactions…', state: 'neutral' },
    { label: '🗳️  Validators voting on transaction set…', state: 'voting' },
    { label: '🤝 Reaching consensus (>80% agreement)…', state: 'voting' },
    { label: '✅ Ledger closed — new validated ledger!', state: 'agreed' },
    { label: '🔄 Preparing for next round…', state: 'neutral' },
  ];

  var stageIdx = 0;

  function runStage() {
    var s = stages[stageIdx];
    stage.textContent = s.label;

    nodes.forEach(function (n) {
      n.classList.remove('voting', 'agreed');
      if (s.state === 'voting') {
        // Stagger the voting colour
        var delay = parseInt(n.getAttribute('data-idx'), 10) * 120;
        setTimeout(function () { n.classList.add('voting'); }, delay);
      } else if (s.state === 'agreed') {
        var delay = parseInt(n.getAttribute('data-idx'), 10) * 80;
        setTimeout(function () { n.classList.add('agreed'); }, delay);
      }
    });

    stageIdx = (stageIdx + 1) % stages.length;
  }

  // Start after a small delay so the user sees the initial state
  setTimeout(function () {
    runStage();
    setInterval(runStage, 1500);
  }, 2000);
})();

/* ── Country data for the simulator ─────────────────────── */
var COUNTRY_DATA = {
  NG: { name: 'Nigeria',      flag: '🇳🇬', currency: 'NGN', label: 'Nigerian Naira',    fxToUSD: 0.00065, tradFeeMin: 7, tradFeeMax: 10 },
  KE: { name: 'Kenya',        flag: '🇰🇪', currency: 'KES', label: 'Kenyan Shilling',   fxToUSD: 0.0077,  tradFeeMin: 6, tradFeeMax: 9  },
  GH: { name: 'Ghana',        flag: '🇬🇭', currency: 'GHS', label: 'Ghanaian Cedi',     fxToUSD: 0.067,   tradFeeMin: 6, tradFeeMax: 9  },
  ZA: { name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', label: 'South African Rand',fxToUSD: 0.054,   tradFeeMin: 8, tradFeeMax: 12 },
  ET: { name: 'Ethiopia',     flag: '🇪🇹', currency: 'ETB', label: 'Ethiopian Birr',    fxToUSD: 0.0175,  tradFeeMin: 8, tradFeeMax: 11 },
  SN: { name: 'Senegal',      flag: '🇸🇳', currency: 'XOF', label: 'CFA Franc',         fxToUSD: 0.0016,  tradFeeMin: 7, tradFeeMax: 10 },
  GB: { name: 'United Kingdom',flag: '🇬🇧',currency: 'GBP', label: 'British Pound',     fxToUSD: 1.27,    tradFeeMin: 0, tradFeeMax: 0  },
  US: { name: 'United States', flag: '🇺🇸',currency: 'USD', label: 'US Dollar',         fxToUSD: 1.00,    tradFeeMin: 0, tradFeeMax: 0  },
  FR: { name: 'France',        flag: '🇫🇷',currency: 'EUR', label: 'Euro',              fxToUSD: 1.09,    tradFeeMin: 0, tradFeeMax: 0  },
  CA: { name: 'Canada',        flag: '🇨🇦',currency: 'CAD', label: 'Canadian Dollar',   fxToUSD: 0.74,    tradFeeMin: 0, tradFeeMax: 0  },
  AE: { name: 'UAE',           flag: '🇦🇪',currency: 'AED', label: 'UAE Dirham',        fxToUSD: 0.272,   tradFeeMin: 0, tradFeeMax: 0  },
  CN: { name: 'China',         flag: '🇨🇳',currency: 'CNY', label: 'Chinese Yuan',      fxToUSD: 0.138,   tradFeeMin: 0, tradFeeMax: 0  },
};

/* ── Simulator selects ───────────────────────────────────── */
(function initSimulatorSelects() {
  var senderSelect    = document.getElementById('senderSelect');
  var recipientSelect = document.getElementById('recipientSelect');
  if (!senderSelect || !recipientSelect) return;

  function updateEndpoint(selectEl, flagEl, countryEl, currencyEl, codeEl) {
    var code = selectEl.value;
    var data = COUNTRY_DATA[code];
    if (!data) return;
    if (flagEl)     flagEl.textContent     = data.flag;
    if (countryEl)  countryEl.textContent  = data.name;
    if (currencyEl) currencyEl.textContent = data.currency + ' — ' + data.label;
    if (codeEl)     codeEl.textContent     = data.currency;
  }

  senderSelect.addEventListener('change', function () {
    updateEndpoint(
      senderSelect,
      document.getElementById('senderFlag'),
      document.getElementById('senderCountry'),
      document.getElementById('senderCurrency'),
      document.getElementById('senderCurrencyCode')
    );
  });

  recipientSelect.addEventListener('change', function () {
    updateEndpoint(
      recipientSelect,
      document.getElementById('recipientFlag'),
      document.getElementById('recipientCountry'),
      document.getElementById('recipientCurrency'),
      document.getElementById('recipientCurrencyCode')
    );
  });
})();

/* ── Payment Simulation ──────────────────────────────────── */
function runSimulation() {
  var amountInput     = document.getElementById('sendAmount');
  var receiveInput    = document.getElementById('receiveAmount');
  var simResult       = document.getElementById('simResult');
  var senderSelect    = document.getElementById('senderSelect');
  var recipientSelect = document.getElementById('recipientSelect');

  if (!amountInput || !receiveInput || !simResult) return;

  var amountStr = amountInput.value.trim();
  var amount    = parseFloat(amountStr);
  if (!amount || amount <= 0) {
    amountInput.focus();
    return;
  }

  var senderCode    = senderSelect.value;
  var recipientCode = recipientSelect.value;
  var sender        = COUNTRY_DATA[senderCode];
  var recipient     = COUNTRY_DATA[recipientCode];

  if (!sender || !recipient) return;

  // Amount is treated as USD equivalent for simplicity
  var amountUSD     = amount;

  // Traditional fee (midpoint of range)
  var tradFeeMin    = sender.tradFeeMin;
  var tradFeeMax    = sender.tradFeeMax;
  var tradFeePct    = (tradFeeMin + tradFeeMax) / 2 / 100;
  var tradFeeUSD    = amountUSD * tradFeePct;

  // XRPL fee — 12 drops of XRP, price fetched live or use fallback
  var xrpPrice      = window.LIVE_XRP_PRICE || 0.55;
  var xrplFeeDrops  = 12;
  var xrplFeeXRP    = xrplFeeDrops / 1e6;
  var xrplFeeUSD    = xrplFeeXRP * xrpPrice;

  // Savings
  var savings       = tradFeeUSD - xrplFeeUSD;

  // Received amount after XRPL fee
  var receivedUSD   = amountUSD - xrplFeeUSD;
  var receivedLocal = receivedUSD / recipient.fxToUSD;

  receiveInput.value = receivedLocal.toLocaleString('en-US', { maximumFractionDigits: 2 });

  document.getElementById('resXrplFee').textContent  = '$' + xrplFeeUSD.toFixed(4);
  document.getElementById('resTradFee').textContent  = tradFeeUSD > 0
    ? '$' + tradFeeUSD.toFixed(2) + ' (' + ((tradFeeMin + tradFeeMax) / 2).toFixed(1) + '%)'
    : 'N/A';
  document.getElementById('resSavings').textContent  = savings > 0
    ? '$' + savings.toFixed(2)
    : '–';

  var msg = '';
  if (savings > 0) {
    msg = '💡 By using the XRP Ledger instead of a traditional wire transfer, you save <strong style="color:var(--green)">$'
      + savings.toFixed(2) + '</strong> on this $' + amount.toLocaleString() + ' transfer. '
      + 'That\'s money that stays in your family\'s pocket — not a bank\'s balance sheet. '
      + 'Settlement occurs in 3–5 seconds, 24/7, with no intermediaries.';
  } else {
    msg = '✅ XRPL fee is effectively zero — nearly all of your transfer reaches the recipient.';
  }
  document.getElementById('resMessage').innerHTML = msg;

  simResult.classList.add('show');
  simResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ── Smooth active nav link highlight on scroll ──────────── */
(function initActiveNav() {
  var sections = document.querySelectorAll('section[id]');
  var navAs    = document.querySelectorAll('.nav-links a[href^="#"]');

  window.addEventListener('scroll', function () {
    var scrollY = window.scrollY + 120;
    var current = '';
    sections.forEach(function (sec) {
      if (sec.offsetTop <= scrollY) current = sec.id;
    });
    navAs.forEach(function (a) {
      a.style.color = '';
      if (a.getAttribute('href') === '#' + current) {
        a.style.color = 'var(--text-primary)';
      }
    });
  }, { passive: true });
})();
