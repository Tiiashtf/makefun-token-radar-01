// The token radar's model (radar-2): a comparables model, calibrated on the snapshot itself.
//
// The board ranks every rankable pre-token protocol in the snapshot: the watchlist (the floor, never
// a ceiling) plus every pre-token protocol below the floor that the watchlist's own rule would keep.
// A protocol is rankable when it records no token and is not a wrapped, staked or bridged product of
// a token that already trades, a versioned pool, or an exchange product — the watchlist's rule
// without its TVL floor. Live-token protocols are kept apart and shown with their market caps.
//
// Implied value is a comparables estimate, not a hardcoded multiple:
//
//   multiple   = the category's median market-cap-to-TVL multiple among the snapshot's own
//                tokened protocols, shrunk toward the global median (5 peers' worth of prior),
//                winsorised at 5x per peer, floored at 0.05x and capped at 1.0x — no protocol is
//                ever credited more than one dollar of implied value per dollar of TVL.
//                A category with no tokened peers uses the global median.
//   growth     = clamp(change_7d, -60, 120) per cent
//   growthMult = 1 + (growth / 100) x 0.5
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age unknown: 365 days)
//   breadth    = 1 + 0.02 x min(chains - 1, 10), at most 1.20
//   implied    = max(1, round(tvl_usd x multiple x growthMult x maturity x breadth))
//
// No protocol name is ever special-cased: the same function scores every row, and the calibration
// table the dashboard shows is computed from the snapshot at run time.
//
// Three further factors, all derived from the snapshot the same way:
//
//   momentum      = a tiered step on the clamped seven-day growth: cooling below -20% (0.92x),
//                   flat from -20% to 0 (0.97x), warming to +10% (1.03x), hot to +30% (1.08x),
//                   surging above +30% (1.14x). A protocol whose TVL is already moving gets
//                   more than the linear growth multiplier alone would give it, and one whose
//                   TVL is shrinking gets less — the step keeps the effect bounded and readable.
//   concentration = 1 + 0.10 x the protocol's share of its category's TVL, at most 1.10x.
//                   The protocol that dominates its category earns a small premium for the
//                   network effects that dominance implies; a small protocol in a large
//                   category earns almost none.
//   confidence    = a band around the implied value from the spread of the category's peer
//                   multiples (25th to 75th percentile, winsorised like the calibration).
//                   The band is clipped to contain the point estimate, so a narrow peer
//                   spread reads as a tight band and a wide one as a wide band.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  shrink_prior: number;
  peer_cap: number;
  multiple_floor: number;
  multiple_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  breadth_step: number;
  breadth_max_extra: number;
}

export const MODEL: ModelConstants = {
  shrink_prior: 5,
  peer_cap: 5,
  multiple_floor: 0.05,
  multiple_cap: 1,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  breadth_step: 0.02,
  breadth_max_extra: 10,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One row of the calibration table: how a category's multiple was set. */
export interface CalibrationRow {
  category: string;
  peers: number;
  median: number | null;
  applied: number;
}

/** The calibration: the global median and one row per ranked category. */
export interface Calibration {
  global_median: number;
  rows: CalibrationRow[];
  by_category: Map<string, number>;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  confidence_low_usd: number;
  confidence_high_usd: number;
  model: {
    base_multiple: number;
    category_median: number | null;
    peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    breadth_multiplier: number;
    momentum_tier: string;
    momentum_multiplier: number;
    category_tvl_share: number;
    concentration_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the model breakdown the page recomputes. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  category_median: number | null;
  peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  breadth_multiplier: number;
  momentum_tier: string;
  momentum_multiplier: number;
  category_tvl_share: number;
  concentration_multiplier: number;
  confidence_low_usd: number;
  confidence_high_usd: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the calibration, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  calibration: CalibrationRow[];
  global_median: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The calibration: every tokened protocol's market-cap-to-TVL multiple, winsorised, grouped by
 * category. A category's applied multiple is its peer median shrunk toward the global median with
 * `shrink_prior` peers' worth of prior, then floored and capped. A category with no tokened peers
 * takes the global median.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const peersByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const multiple = Math.min(p.mcap_usd / p.tvl_usd, model.peer_cap);
    all.push(multiple);
    const key = p.category ?? '';
    const list = peersByCategory.get(key) ?? [];
    list.push(multiple);
    peersByCategory.set(key, list);
  }
  const globalMedian = all.length > 0 ? median(all) : 0.25;
  const clampMult = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const rows: CalibrationRow[] = [];
  const byCategory = new Map<string, number>();
  const categories = [...new Set(snapshot.protocols.map((p) => p.category ?? ''))].sort();
  for (const category of categories) {
    const peers = peersByCategory.get(category) ?? [];
    const med = peers.length > 0 ? median(peers) : null;
    const applied = med === null ? clampMult(globalMedian) : clampMult((peers.length * med + model.shrink_prior * globalMedian) / (peers.length + model.shrink_prior));
    rows.push({ category, peers: peers.length, median: med === null ? null : Math.round(med * 1000) / 1000, applied: Math.round(applied * 1000) / 1000 });
    byCategory.set(category, applied);
  }
  return { global_median: Math.round(globalMedian * 1000) / 1000, rows, by_category: byCategory };
}

/** The multipliers and the implied value one protocol gets under the calibrated model. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
  categoryTotal: number | null = null,
): { implied: number; multiple: number; categoryMedian: number | null; peers: number; growthPct: number; growthMult: number; maturityMult: number; breadthMult: number; momentumTier: string; momentumMult: number; share: number; concentrationMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const category = protocol.category ?? '';
  const row = calibration.rows.find((r) => r.category === category);
  const multiple = row === undefined ? calibration.global_median : row.applied;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const extraChains = Math.min(Math.max(protocol.chains.length - 1, 0), model.breadth_max_extra);
  const breadthMult = 1 + extraChains * model.breadth_step;
  const momentum = momentumTier(growthPct);
  const concentration = concentrationFor(protocol.tvl_usd, categoryTotal);
  const base = protocol.tvl_usd * multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * breadthMult * momentum.multiplier * concentration.multiplier));
  return { implied, multiple, categoryMedian: row?.median ?? null, peers: row?.peers ?? 0, growthPct, growthMult, maturityMult, breadthMult, momentumTier: momentum.tier, momentumMult: momentum.multiplier, share: concentration.share, concentrationMult: concentration.multiplier, age };
}

/** One momentum tier: its name and the multiplier it applies to the implied value. */
export interface MomentumTier {
  tier: string;
  multiplier: number;
}

/**
 * The momentum tier: a step on the clamped seven-day growth, so a protocol whose TVL is already
 * moving fast earns more than the linear growth multiplier alone would give it, and one whose TVL
 * is shrinking earns less. The step keeps the effect bounded and readable at a glance.
 */
export function momentumTier(growthPct: number): MomentumTier {
  if (growthPct < -20) return { tier: 'cooling', multiplier: 0.92 };
  if (growthPct < 0) return { tier: 'flat', multiplier: 0.97 };
  if (growthPct < 10) return { tier: 'warming', multiplier: 1.03 };
  if (growthPct < 30) return { tier: 'hot', multiplier: 1.08 };
  return { tier: 'surging', multiplier: 1.14 };
}

/** Each category's total TVL across the whole snapshot, for the concentration factor. */
export function categoryTotals(snapshot: Snapshot): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of snapshot.protocols) {
    const key = p.category ?? '';
    totals.set(key, (totals.get(key) ?? 0) + p.tvl_usd);
  }
  return totals;
}

/**
 * The concentration premium: a protocol's share of its category's TVL, and the multiplier that
 * share earns. The protocol that dominates its category gets up to a 10% premium for the network
 * effects that dominance implies; a small protocol in a large category gets almost none.
 */
export function concentrationFor(tvlUsd: number, categoryTotal: number | null): { share: number; multiplier: number } {
  const share = categoryTotal !== null && categoryTotal > 0 ? Math.min(tvlUsd / categoryTotal, 1) : 0;
  return { share: Math.round(share * 1e4) / 1e4, multiplier: Math.round((1 + 0.1 * share) * 1e4) / 1e4 };
}

/** The peer multiples of every category, winsorised like the calibration, plus the global list. */
export interface PeerSpreads {
  byCategory: Map<string, number[]>;
  global: number[];
}

export function peerMultiplesByCategory(snapshot: Snapshot, model: ModelConstants = MODEL): PeerSpreads {
  const byCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const multiple = Math.min(p.mcap_usd / p.tvl_usd, model.peer_cap);
    all.push(multiple);
    const key = p.category ?? '';
    const list = byCategory.get(key) ?? [];
    list.push(multiple);
    byCategory.set(key, list);
  }
  return { byCategory, global: all };
}

/** A percentile of a sorted list, by nearest rank. */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const at = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)));
  return sorted[at]!;
}

/**
 * The 25th-to-75th-percentile peer multiples for a category. A category with fewer than four
 * tokened peers cannot be read on its own, so the global spread stands in for it.
 */
export function peerSpread(category: string, spreads: PeerSpreads): { low: number; high: number } {
  const peers = spreads.byCategory.get(category) ?? [];
  const list = peers.length >= 4 ? [...peers].sort((a, b) => a - b) : [...spreads.global].sort((a, b) => a - b);
  return { low: percentile(list, 0.25), high: percentile(list, 0.75) };
}

/**
 * The confidence band around a point estimate: the peer-spread multiples applied to the same
 * factors the estimate uses, clipped to contain the estimate. A narrow peer spread reads as a
 * tight band, a wide one as a wide band.
 */
export function confidenceBand(implied: number, multiple: number, spread: { low: number; high: number }): { low: number; high: number } {
  if (!(multiple > 0) || !Number.isFinite(spread.low) || !Number.isFinite(spread.high)) return { low: implied, high: implied };
  const low = Math.max(1, Math.round((implied * spread.low) / multiple));
  const high = Math.max(1, Math.round((implied * spread.high) / multiple));
  return { low: Math.min(low, implied), high: Math.max(high, implied) };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist's rule leaves out: wrapped, staked or bridged products of a token that trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying a whole word wrapped, staked or staking, in any case. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** An exchange's name at the start of a protocol's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades — the watchlist's rule without its TVL floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot, model);
  const totals = categoryTotals(snapshot);
  const spreads = peerMultiplesByCategory(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist floor. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model, totals.get(p.category ?? '') ?? null);
    const spread = peerSpread(p.category ?? '', spreads);
    const band = confidenceBand(v.implied, v.multiple, spread);
    return { p, ...v, band };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    confidence_low_usd: s.band.low,
    confidence_high_usd: s.band.high,
    model: {
      base_multiple: s.multiple,
      category_median: s.categoryMedian,
      peers: s.peers,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      breadth_multiplier: round4(s.breadthMult),
      momentum_tier: s.momentumTier,
      momentum_multiplier: round4(s.momentumMult),
      category_tvl_share: s.share,
      concentration_multiplier: round4(s.concentrationMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('risk curat') || c.includes('curator') || c.includes('capital allocator')) return `Deposit $${capital} of USDC into the ${name} curated vault on ${chain} and hold the vault shares.`;
  if (c.includes('basis trad')) return `Deposit $${capital} of USDC into ${name}'s basis-trading vault on ${chain} and hold the shares.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the supply position open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain} and keep the position in range.`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into the ${name} yield vault on ${chain} and hold the shares.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it in your wallet.`;
  if (c.includes('restak') || c.includes('staking')) return `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} on ${chain} and place one market position.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payments')) return `Move $${capital} of USDC through ${name} on ${chain} and keep a balance in its app.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to the ${name} chain and use its main app at least once a week.`;
  if (c.includes('index')) return `Buy $${capital} of the ${name} index token on ${chain} and hold it.`;
  if (c.includes('leveraged farm') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s main farm on ${chain} and keep the position open.`;
  if (c.includes('liquidity manager')) return `Deposit $${capital} of USDC into the ${name} managed liquidity vault on ${chain} and hold the shares.`;
  if (c.includes('interest rate')) return `Open a $${capital} fixed-rate position on ${name} on ${chain} and hold it to its term.`;
  if (c.includes('otc')) return `Place a $${capital} order on ${name} on ${chain} and settle it in your wallet.`;
  if (c.includes('crypto card')) return `Order the ${name} card, load it with $${capital} of USDC and spend from it on ${chain}.`;
  if (c.includes('governance')) return `Deposit $${capital} of USDC into ${name} on ${chain} and vote in its next proposal.`;
  if (c.includes('anchor') || c.includes('decentralized btc')) return `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`;
  if (c.includes('dual-token')) return `Mint $${capital} of the stable token through ${name} on ${chain} and stake the paired governance token.`;
  if (c.includes('uncollateralized')) return `Lend $${capital} of USDC to ${name}'s borrower pool on ${chain} and keep the loan open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different action on the same protocol, so the wallet shows repeat use. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (p.chains.length > 1) {
    const other = p.chains[1]!;
    return `Move about half the position to ${other} and repeat the action there, so the wallet is active on both chains.`;
  }
  if (c.includes('dex')) return `Add a second, narrower-range liquidity position in the same ${name} pool to raise the fee share.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow a small amount against the ${name} supply, then repay it, to register both sides of the market.`;
  if (c.includes('yield') || c.includes('rwa') || c.includes('curator') || c.includes('capital allocator')) return `Split the deposit across a second ${name} vault on ${chain} to show repeat use.`;
  if (c.includes('restak') || c.includes('staking')) return `Top the stake up once more after a week, so the receipt shows two deposits.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the first hedge and open a second one in the opposite direction to show two-way activity.`;
  return `Repeat the action with a second, smaller position to show the wallet is still active.`;
}

/** The gas asset a chain's own transactions settle in, for the chain step's concrete action. */
function gasAsset(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes('solana')) return 'SOL';
  if (c.includes('avalanche')) return 'AVAX';
  if (c.includes('binance') || c.includes('bnb')) return 'BNB';
  if (c.includes('polygon')) return 'POL';
  if (c.includes('tron')) return 'TRX';
  if (c.includes('sui')) return 'SUI';
  if (c.includes('sonic')) return 'S';
  if (c.includes('fantom')) return 'FTM';
  if (c.includes('near')) return 'NEAR';
  if (c.includes('cosmos') || c.includes('osmosis')) return 'ATOM';
  if (c.includes('hyperliquid')) return 'HYPE';
  return 'ETH';
}

/** The chain's canonical way in for fresh funds, named so the step is concrete, not generic. */
function bridgeHint(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes('arbitrum')) return 'the Arbitrum official bridge';
  if (c.includes('optimism')) return 'the Optimism official bridge';
  if (c.includes('base')) return 'the Base official bridge';
  if (c.includes('linea')) return 'the Linea official bridge';
  if (c.includes('scroll')) return 'the Scroll official bridge';
  if (c.includes('mantle')) return 'the Mantle official bridge';
  if (c.includes('zksync')) return 'the zkSync official bridge';
  if (c.includes('blast')) return 'the Blast official bridge';
  if (c.includes('mode')) return 'the Mode official bridge';
  if (c.includes('solana')) return 'a wrapped-USDC bridge such as Wormhole';
  if (c.includes('sui')) return 'a wrapped-USDC bridge such as Wormhole';
  if (c.includes('avalanche')) return 'the Avalanche bridge';
  if (c.includes('polygon')) return 'the Polygon PoS bridge';
  if (c.includes('binance') || c.includes('bnb')) return 'the BNB Chain bridge';
  if (c.includes('hyperliquid')) return 'the Hyperliquid bridge';
  if (c.includes('monad')) return 'the Monad bridge';
  return 'the chain\u2019s own canonical bridge';
}

/**
 * The chain step: a concrete move on the protocol's own chains, naming the actual chain and the
 * bridge or asset the move uses, so the plan is different for a two-chain protocol and a
 * single-chain one.
 */
function chainStepFor(p: SnapshotProtocol, capital: number, chain: string): string {
  if (p.chains.length > 1) {
    const other = p.chains[1]!;
    return `Bridge $${Math.max(10, Math.round(capital / 2))} of the position from ${chain} to ${other} through ${bridgeHint(other)}, then repeat the main action on ${other} so the wallet is active on both chains.`;
  }
  return `On ${chain}, swap a small part of the position into ${gasAsset(chain)} through ${p.name}'s own route, so the wallet holds the chain's gas asset and can transact without a rescue transfer.`;
}

/**
 * The risk step: what can go wrong with this protocol's farm, named from its own category, TVL
 * and age, with the check that keeps the loss small.
 */
function riskStepFor(p: SnapshotProtocol, age: number | null): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('dex') || c.includes('liquidity manager') || c.includes('leveraged farm')) return `What can go wrong: the pool's price can move against the position and leave an impermanent loss bigger than the fees earned. Check the pool's range every week and exit if the position sits out of range for two weeks.`;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `What can go wrong: a sharp fall in the collateral can liquidate the position before you can top it up. Keep the loan well below the liquidation line and set a price alert at the level where you would repay.`;
  if (c.includes('rwa')) return `What can go wrong: the yield-bearing asset is only as good as its off-chain issuer and custodian. Read the issuer's attestation and redemption terms before minting, and keep the position small enough to exit through the secondary market.`;
  if (c.includes('risk curat') || c.includes('curator') || c.includes('capital allocator') || c.includes('yield')) return `What can go wrong: the vault's curator can change the strategy or the underlying market can turn, and the shares can fall. Check the vault's strategy page each month and withdraw if the strategy changes without notice.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('basis trad')) return `What can go wrong: funding rates can turn against the hedge and the margin can be liquidated in a fast move. Keep the position small, watch the funding rate daily, and close it if the rate stays against you for a week.`;
  if (c.includes('bridge') || c.includes('chain')) return `What can go wrong: the bridge contract itself is the risk, and a bridge failure can strand the funds. Bridge in two smaller amounts instead of one, and confirm the first arrival before sending the second.`;
  if (c.includes('restak') || c.includes('staking') || c.includes('liquid staking')) return `What can go wrong: the receipt token can depeg from the staked asset, or the validator set can be slashed. Check the peg weekly and unstake if the receipt trades more than 2% below its backing for a week.`;
  if (c.includes('stable') || c.includes('algo-stable')) return `What can go wrong: the stable asset can lose its peg if its backing or its mechanism fails. Check the peg and the backing report before depositing, and exit if the peg slips more than 1% for a day.`;
  if (p.tvl_usd >= 1_000_000_000) return `What can go wrong: a protocol this large is a target, and a contract bug would be found fast. Check that the contracts are audited and that the audit covers the vault you use, and keep no more than the planned capital in it.`;
  if (age !== null && age < 180) return `What can go wrong: ${name} is young, so its contracts have had little time in the wild and its points program can change. Farm with the planned capital only, and re-check the points page before each new deposit.`;
  return `What can go wrong: the contract can hold a bug no audit caught, and the points program can change before launch. Keep the position to the planned capital, and treat every deposit as money you can afford to lose.`;
}

/**
 * A protocol's farm plan: nine steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age, seven-day growth), never from a
 * hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const growth = p.change_7d;
  const fast = growth !== null && growth > 15;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `about $${capital >= 150 ? 6 : 3} of gas`,
      time: '10 minutes',
    },
    {
      text: fast
        ? `Act twice a week while ${p.name}'s TVL is growing fast, such as a deposit, a swap or a vote.`
        : `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: fast ? 'about $4 of gas a week' : 'about $2 of gas a week',
      time: fast ? '15 minutes a week' : '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and plan the unwind in two steps so you can exit without losing the position's history.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: chainStepFor(p, capital, chain),
      cost: 'about $3 of gas for the bridge or swap',
      time: '15 minutes',
    },
    {
      text: riskStepFor(p, age),
      cost: 'nothing to check, and never pay to remove a risk',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the model breakdown the page recomputes. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    category_median: row.model.category_median,
    peers: row.model.peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    breadth_multiplier: row.model.breadth_multiplier,
    momentum_tier: row.model.momentum_tier,
    momentum_multiplier: row.model.momentum_multiplier,
    category_tvl_share: row.model.category_tvl_share,
    concentration_multiplier: row.model.concentration_multiplier,
    confidence_low_usd: row.confidence_low_usd,
    confidence_high_usd: row.confidence_high_usd,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const calibration = calibrate(snapshot, model);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    calibration: calibration.rows,
    global_median: calibration.global_median,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100) return `the board holds ${board.length} rows, under the 100-row floor`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
