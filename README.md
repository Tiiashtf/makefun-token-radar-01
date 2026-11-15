# Token Radar

The best token launch radar: a board of pre-token DeFi protocols ranked by implied value,
with a farm plan for each one and a dashboard a reader can use.

## How it works

`main.ts` (Node 22, standard library only) reads the sealed DefiLlama snapshot at
`/input/snapshot.json`, scores every rankable pre-token protocol, and writes:

- `/output/board.json` — 198 rows: all 40 watchlist protocols plus the 158 pre-token
  protocols below the $50M floor that the watchlist's own rule would keep.
- `/output/data.js` — the same board, compact, for the dashboard.
- `/output/dashboard/` — the static page (`index.html`, `app.css`, `app.js`): sortable
  board, search, category and chain filters, a pre-token / live-token switch, a detail
  view per protocol, the model, and the calibration table.
- `/output/screenshots/` — the board, a protocol detail view, and a filtered view,
  captured from the real dashboard in headless Chromium.
- `/output/dossier.json` — built with `buildDossier` from `vendor/makefun-board.ts`.

## The model (radar-2)

A comparables model, calibrated on the snapshot itself — no hardcoded multiple, no
protocol name special-cased:

```
multiple   = category median of market-cap / TVL among the snapshot's own tokened
             protocols (each peer winsorised at 5x), shrunk toward the global
             median (0.214x) with 5 peers' worth of prior; floored at 0.05x,
             capped at 1.0x. A category with no tokened peers takes the global median.
growth     = clamp(change_7d, -60, 120)%
growthMult = 1 + growth / 100 x 0.5
maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (unknown age: 365 days)
breadth    = 1 + 0.02 x min(chains - 1, 10)
implied    = max(1, round(tvl_usd x multiple x growthMult x maturity x breadth))
```

Top of the board (snapshot 2026-11-14): Steakhouse Financial at ~$1.76B implied
($2.75B TVL x 0.674x Risk Curators multiple), then Sentora Curator and Gauntlet.
Every row carries a 7-step farm plan derived from its own category, chains, TVL, age
and seven-day growth — concrete actions with a cost and a time, never generic filler.

## Run it locally

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

The run is deterministic: two runs on the same snapshot write byte-identical
`board.json` and `dossier.json`.

## License

MIT. See `LICENSE`.
