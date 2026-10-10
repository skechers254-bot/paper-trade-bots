# Signal Desk

Signal Desk is a static paper-trading demo with a synthetic market board, a local demo portfolio, and sample strategy bots.

[Open the live demo](https://skechers254-bot.github.io/paper-trade-bots/).

## Run locally

Open `index.html` in a browser, or serve this folder with any static web server. No package installation or build step is required.

## Demo limitations

- All prices, volume, balances, orders, charts, and bot results are synthetic.
- The app does not connect to a brokerage, exchange, or market-data provider.
- Orders only change the demo portfolio saved in this browser's local storage.
- Sample bots only simulate status and demo P&L; they never submit orders.
- This is not investment advice and must not be used to make real trading decisions.

Use **Reset demo data** in the account area to clear the local demo session.

## Publish with GitHub Pages

The included workflow deploys the static app when changes are pushed to `main`. GitHub Pages is enabled with **GitHub Actions** as its deployment source. The app does not need secrets or environment variables.
