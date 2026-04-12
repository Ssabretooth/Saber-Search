# XRP Africa — Powering Financial Corridors Across the Continent

An educational, interactive website showcasing the utility of **XRP** and the **XRP Ledger (XRPL)** in transforming cross-border payments and financial inclusion across Africa.

## 🌍 What It Does

- **Educational content** — explains the problem (expensive, slow remittances) and how XRPL solves it
- **Use-case explorer** — remittances, trade finance, CBDCs, DeFi, and NFTs for Africa
- **African corridor breakdowns** — fee and speed comparisons for key routes (Nigeria→UK, Kenya→USA, etc.)
- **Live XRPL demo** — real-time ledger data, live transaction feed, and network stats via the public XRPL WebSocket API
- **Payment simulator** — enter an amount and countries to see your XRPL savings vs traditional wire
- **Technical deep dive** — accordion sections covering consensus, ODL, transaction types, and developer APIs

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5 / CSS3 / JavaScript (ES5-compatible) |
| XRPL connectivity | [xrpl.js](https://github.com/XRPLF/xrpl.js) v3 (CDN) |
| Price data | CoinGecko free public API |
| Fonts | Google Fonts (Inter + JetBrains Mono) |
| No build step | Pure static files — open `index.html` in a browser |

## 📁 Project Structure

```
├── index.html          # Main single-page application
├── css/
│   └── style.css       # All styles (dark theme, responsive)
└── js/
    ├── app.js          # UI interactivity (nav, tabs, accordion, simulator)
    └── xrpl-demo.js    # Live XRPL WebSocket connection & data feed
```

## 🚀 Running Locally

No build step required — just serve the files:

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node (npx)
npx serve .

# Option 3: VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

## 🔌 APIs Used

| API | Purpose | Cost |
|---|---|---|
| `wss://xrplcluster.com` | XRPL mainnet WebSocket (live ledger & tx stream) | Free |
| `wss://s1.ripple.com` | XRPL fallback node | Free |
| CoinGecko `/simple/price` | XRP/USD price + 24h change | Free |

## 📄 Disclaimer

This website is for **educational purposes only**. Payment simulations do not involve real funds. Nothing on this site constitutes financial advice.

## 📚 Resources

- [XRPL.org Documentation](https://xrpl.org/docs.html)
- [Ripple.com](https://ripple.com)
- [XRPL Testnet Faucet](https://xrpl.org/xrp-testnet-faucet.html)
- [World Bank Remittance Prices](https://remittanceprices.worldbank.org/)
