# MarketLab — P_195

An educational market decision laboratory. Learn core ideas, research historical Indian stocks, train and evaluate a next-day direction model, record a prediction before seeing the answer, then use the BlindMarket replay simulator to test virtual decisions. A guided 20-trading-day Challenge connects these steps and ends with a decision debrief. Built with FastAPI/SQLAlchemy, Next.js/TypeScript/Tailwind, and SQLite by default.

## The learning loop

1. **Learn:** `/learn` has short interactive lessons on prediction, fair testing, journaling, and diversification.
2. **Research:** `/explore` and stock pages show historical prices up to the simulation date. `/model-lab` trains a model on only the history available then.
3. **Predict:** `/journal` records the stock, your reason, expected direction, and a horizon of 1, 5, or 20 available stock closes. The order ticket can also save a journal entry linked to a virtual order. A one-day entry freezes any available next-day model prediction and a simple historical-majority baseline.
4. **Replay:** `/replay` advances historical time and processes pending orders. Journal outcomes remain hidden until the selected number of later stock closes is available.
5. **Review:** the Journal compares one-day calls with the saved model and baseline. Longer-horizon entries review your prediction only, because the current model predicts just the next day. `/results` compares virtual portfolio performance with NIFTY 50. Direction accuracy is not the same as trading profit.

For a guided route, open `/challenge` after creating a simulation. The challenge tracks activity over 20 revealed trading days and, once complete, compares portfolio return, benchmark return, drawdown, recorded predictions, and comparable one-day model/baseline calls. Its lesson links are chosen from recorded outcomes. The debrief is frozen at the challenge endpoint even if the simulation later continues.

Model Lab also reports three earlier expanding-window walk-forward checks before its final 20% holdout, plus a history of saved training runs. A model is only labeled above baseline when both the final holdout and earlier checks pass the app's threshold. Historical test results cannot guarantee future performance.

The journal and model are educational tools, not investment advice. Training never places a trade automatically.

## Quick start

From the `BlindMarket` folder, run `npm run dev`. This starts the backend and frontend together. Open the **App URL printed in the terminal** (normally `http://localhost:3000`), and press Ctrl+C to stop the servers started there. The dependencies and historical data must be installed once as described below.

If an older process still occupies port 8000 or 3000, the launcher leaves it alone and starts this version on free local ports. Use the App URL it prints rather than an old browser tab. If you prefer the usual 3000/8000 ports, stop the old development terminals with Ctrl+C first.

## Run locally

```powershell
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
cd backend
python import_market.py
uvicorn app.main:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The API docs are at `http://localhost:8000/docs`.

If Hugging Face downloads are unavailable, download the pinned dataset revision manually and run `python import_market.py --local D:\path\to\dataset`. The local folder must contain `stocks/` and `indices/`. With an empty database the UI directs users to setup, and the API health response reports zero instruments.

## Data and reproducibility

The importer pins `vishnun0027/indian-market-historical-ohlcv` at revision `fe783082c7ec68847ecd0d0b4e1ca06364507e5f`, imports 12 cross-sector stocks plus `NIFTY_50`, and defaults to 2019–2021. It validates schema, nulls, duplicate dates, OHLC bounds, coverage, and corporate-action rows, then records the source, revision, symbols, coverage, timestamp, and validation report in `import_runs`.

Execution uses raw OHLC and never uses retrospectively adjusted prices. On each date advance, declared split ratios adjust held quantity/average cost before fills and dividends credit cash, all in the same transaction. This avoids future leakage and double adjustment.

## Simulation rules

- Starting cash is ₹1,00,000; money is rounded half-up to paise and database prices use fixed-point decimals.
- An order entered after observing D can only fill on a later trading day. Market orders fill at the next available open.
- Buy limits fill at the open if open ≤ limit, otherwise at limit if low reaches it. Sell limits mirror this rule using high. Daily OHLC cannot prove the exact intraday path.
- Pending limit buys reserve their full limit value; market buys reserve the latest observable close estimate. Pending sells reserve shares. No shorting, leverage, derivatives, or real-money execution. Optional simulated charges are available per session.
- Holdings use average-cost accounting. Selling realizes `(fill − average cost) × quantity`; partial sales preserve average cost.
- Equity is cash plus close-marked holdings. Annualised volatility uses available snapshot returns (252-day convention); insufficient histories are labeled. Maximum drawdown uses the snapshot equity peak. Benchmark data is imported as price-return data and plotted against the portfolio on the same dates.
- Backend date predicates enforce the active simulation date. Ownership checks protect every session/order path.

## Learning features

- **Trainable Model Lab:** choose an imported stock and press **Train model**. The app trains a deterministic logistic-regression classifier for whether the next trading day's raw close will exceed today's close. Six features use only raw OHLCV known by the current simulation date: 1-, 5-, and 10-day returns; 10-day volatility; today's range; and today's volume relative to its 20-day history. Windows crossing stock splits are excluded. It needs at least 160 labeled examples; at the start of the data range the app displays how much more history is needed.
- **Evaluation:** the earliest 80% of labeled examples train the evaluation model; the latest 20% are an untouched chronological holdout. The lab reports holdout accuracy, a training-majority baseline, Brier score, confusion counts, training loss, and recent test predictions. The final saved model is then refit on all labels available through the simulation date. The current day's label remains unknown. Training the same stock/date/version again reuses its saved run. Model weights and preprocessing statistics are stored as JSON in `model_runs`, scoped to the user's session.
- **Forecast use:** the lab shows a next-day up score and links to the stock's chart and order ticket. The score is not calibrated or guaranteed; training does not place a trade. Later simulation dates can retrain using newly observed outcomes. For a demonstration, start on 3 February 2020 and try RELIANCE; 2019 history is already available for training.

- **Trading costs (optional per session):** STT 0.1% both sides, NSE transaction charges, SEBI fee, GST on those, stamp duty 0.015% on buys, DP charge ₹13 + GST on sells, zero brokerage. Costs are reserved on pending buys and recorded as `fees` ledger entries.
- **Market events:** a curated timeline of real 2019–2021 events (`backend/app/events.py`). The API only returns events on or before the simulated date, so it never leaks the future.
- **Post-trade reveal:** the results page compares every fill with the latest price and labels it Working / Underwater / Good exit / Sold too early.
- **Diversification check:** 0–100 score and plain-language warnings for concentration by stock and sector, and for idle or missing cash.
- **Leaderboard:** players grouped by identical start date, ranked by return, usernames masked. Suited to a class exercise.

## Checks

```powershell
cd backend
python -m pytest tests -q
cd ../frontend
npm run typecheck
npm run build
```

Tests cover next-day fills, average cost, partial sales, limit orders, reservations, user isolation, future-data exclusion, point-in-time model features, chronological holdout, repeatable training, session-owned model runs, and journal outcome timing and ownership.
