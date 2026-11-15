// Token Radar's plain dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail drawer with the model's own
// inputs and the protocol's farm plan, and the calibration table the multiples come from.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(3) + 'x';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  // The category multiple is the row's own calibrated multiple, the same value main.ts used, and the
  // momentum and concentration multipliers are the row's own too, so the recompute needs no new data.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var extraChains = Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_max_extra);
    var breadth = 1 + extraChains * model.breadth_step;
    var momentum = row.momentum_multiplier === null || row.momentum_multiplier === undefined ? 1 : row.momentum_multiplier;
    var concentration = row.concentration_multiplier === null || row.concentration_multiplier === undefined ? 1 : row.concentration_multiplier;
    return Math.max(1, Math.round(row.tvl_usd * row.base_multiple * growthMult * maturity * breadth * momentum * concentration));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL, age and
  // seven-day growth decide the action, the second action, the cadence, the hold and every cost and
  // time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('risk curat') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('capital allocator') >= 0) return 'Deposit $' + capital + ' of USDC into the ' + name + ' curated vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('basis trad') >= 0) return 'Deposit $' + capital + " of USDC into " + name + "'s basis-trading vault on " + chain + ' and hold the shares.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the supply position open.';
    if (c.indexOf('dex') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s largest pool on " + chain + ' and keep the position in range.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + ' of USDC into the ' + name + ' yield vault on ' + chain + ' and hold the shares.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + "'s yield-bearing asset on " + chain + ' and hold it in your wallet.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' on ' + chain + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' on ' + name + ' on ' + chain + ' and place one market position.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('payments') >= 0) return 'Move $' + capital + ' of USDC through ' + name + ' on ' + chain + " and keep a balance in its app.";
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('chain') >= 0) return 'Bridge $' + capital + ' of USDC to the ' + name + ' chain and use its main app at least once a week.';
    if (c.indexOf('index') >= 0) return 'Buy $' + capital + ' of the ' + name + ' index token on ' + chain + ' and hold it.';
    if (c.indexOf('leveraged farm') >= 0 || c.indexOf('farm') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s main farm on " + chain + ' and keep the position open.';
    if (c.indexOf('liquidity manager') >= 0) return 'Deposit $' + capital + ' of USDC into the ' + name + ' managed liquidity vault on ' + chain + ' and hold the shares.';
    if (c.indexOf('interest rate') >= 0) return 'Open a $' + capital + ' fixed-rate position on ' + name + ' on ' + chain + ' and hold it to its term.';
    if (c.indexOf('otc') >= 0) return 'Place a $' + capital + ' order on ' + name + ' on ' + chain + ' and settle it in your wallet.';
    if (c.indexOf('crypto card') >= 0) return 'Order the ' + name + ' card, load it with $' + capital + ' of USDC and spend from it on ' + chain + '.';
    if (c.indexOf('governance') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and vote in its next proposal.';
    if (c.indexOf('anchor') >= 0 || c.indexOf('decentralized btc') >= 0) return 'Mint $' + capital + ' of the BTC-backed asset through ' + name + ' on ' + chain + ' and hold it.';
    if (c.indexOf('dual-token') >= 0) return 'Mint $' + capital + ' of the stable token through ' + name + ' on ' + chain + ' and stake the paired governance token.';
    if (c.indexOf('uncollateralized') >= 0) return 'Lend $' + capital + ' of USDC to ' + name + "'s borrower pool on " + chain + ' and keep the loan open.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (p.chains && p.chains.length > 1) return 'Move about half the position to ' + p.chains[1] + ' and repeat the action there, so the wallet is active on both chains.';
    if (c.indexOf('dex') >= 0) return 'Add a second, narrower-range liquidity position in the same ' + name + ' pool to raise the fee share.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow a small amount against the ' + name + ' supply, then repay it, to register both sides of the market.';
    if (c.indexOf('yield') >= 0 || c.indexOf('rwa') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('capital allocator') >= 0) return 'Split the deposit across a second ' + name + ' vault on ' + chain + ' to show repeat use.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0) return 'Top the stake up once more after a week, so the receipt shows two deposits.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the first hedge and open a second one in the opposite direction to show two-way activity.';
    return 'Repeat the action with a second, smaller position to show the wallet is still active.';
  }
  function gasAsset(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('solana') >= 0) return 'SOL';
    if (c.indexOf('avalanche') >= 0) return 'AVAX';
    if (c.indexOf('binance') >= 0 || c.indexOf('bnb') >= 0) return 'BNB';
    if (c.indexOf('polygon') >= 0) return 'POL';
    if (c.indexOf('tron') >= 0) return 'TRX';
    if (c.indexOf('sui') >= 0) return 'SUI';
    if (c.indexOf('sonic') >= 0) return 'S';
    if (c.indexOf('fantom') >= 0) return 'FTM';
    if (c.indexOf('near') >= 0) return 'NEAR';
    if (c.indexOf('cosmos') >= 0 || c.indexOf('osmosis') >= 0) return 'ATOM';
    if (c.indexOf('hyperliquid') >= 0) return 'HYPE';
    return 'ETH';
  }
  function bridgeHint(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('arbitrum') >= 0) return 'the Arbitrum official bridge';
    if (c.indexOf('optimism') >= 0) return 'the Optimism official bridge';
    if (c.indexOf('base') >= 0) return 'the Base official bridge';
    if (c.indexOf('linea') >= 0) return 'the Linea official bridge';
    if (c.indexOf('scroll') >= 0) return 'the Scroll official bridge';
    if (c.indexOf('mantle') >= 0) return 'the Mantle official bridge';
    if (c.indexOf('zksync') >= 0) return 'the zkSync official bridge';
    if (c.indexOf('blast') >= 0) return 'the Blast official bridge';
    if (c.indexOf('mode') >= 0) return 'the Mode official bridge';
    if (c.indexOf('solana') >= 0) return 'a wrapped-USDC bridge such as Wormhole';
    if (c.indexOf('sui') >= 0) return 'a wrapped-USDC bridge such as Wormhole';
    if (c.indexOf('avalanche') >= 0) return 'the Avalanche bridge';
    if (c.indexOf('polygon') >= 0) return 'the Polygon PoS bridge';
    if (c.indexOf('binance') >= 0 || c.indexOf('bnb') >= 0) return 'the BNB Chain bridge';
    if (c.indexOf('hyperliquid') >= 0) return 'the Hyperliquid bridge';
    if (c.indexOf('monad') >= 0) return 'the Monad bridge';
    return 'the chain\u2019s own canonical bridge';
  }
  function chainStepFor(p, capital, chain) {
    if (p.chains && p.chains.length > 1) {
      var other = p.chains[1];
      return 'Bridge $' + Math.max(10, Math.round(capital / 2)) + ' of the position from ' + chain + ' to ' + other + ' through ' + bridgeHint(other) + ', then repeat the main action on ' + other + ' so the wallet is active on both chains.';
    }
    return 'On ' + chain + ', swap a small part of the position into ' + gasAsset(chain) + ' through ' + p.name + '\'s own route, so the wallet holds the chain\'s gas asset and can transact without a rescue transfer.';
  }
  function riskStepFor(p) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('dex') >= 0 || c.indexOf('liquidity manager') >= 0 || c.indexOf('leveraged farm') >= 0) return 'What can go wrong: the pool\'s price can move against the position and leave an impermanent loss bigger than the fees earned. Check the pool\'s range every week and exit if the position sits out of range for two weeks.';
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'What can go wrong: a sharp fall in the collateral can liquidate the position before you can top it up. Keep the loan well below the liquidation line and set a price alert at the level where you would repay.';
    if (c.indexOf('rwa') >= 0) return 'What can go wrong: the yield-bearing asset is only as good as its off-chain issuer and custodian. Read the issuer\'s attestation and redemption terms before minting, and keep the position small enough to exit through the secondary market.';
    if (c.indexOf('risk curat') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('capital allocator') >= 0 || c.indexOf('yield') >= 0) return 'What can go wrong: the vault\'s curator can change the strategy or the underlying market can turn, and the shares can fall. Check the vault\'s strategy page each month and withdraw if the strategy changes without notice.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis trad') >= 0) return 'What can go wrong: funding rates can turn against the hedge and the margin can be liquidated in a fast move. Keep the position small, watch the funding rate daily, and close it if the rate stays against you for a week.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('chain') >= 0) return 'What can go wrong: the bridge contract itself is the risk, and a bridge failure can strand the funds. Bridge in two smaller amounts instead of one, and confirm the first arrival before sending the second.';
    if (c.indexOf('restak') >= 0 || c.indexOf('staking') >= 0 || c.indexOf('liquid staking') >= 0) return 'What can go wrong: the receipt token can depeg from the staked asset, or the validator set can be slashed. Check the peg weekly and unstake if the receipt trades more than 2% below its backing for a week.';
    if (c.indexOf('stable') >= 0 || c.indexOf('algo-stable') >= 0) return 'What can go wrong: the stable asset can lose its peg if its backing or its mechanism fails. Check the peg and the backing report before depositing, and exit if the peg slips more than 1% for a day.';
    if (p.tvl_usd >= 1e9) return 'What can go wrong: a protocol this large is a target, and a contract bug would be found fast. Check that the contracts are audited and that the audit covers the vault you use, and keep no more than the planned capital in it.';
    if (p.age_days !== null && p.age_days !== undefined && p.age_days < 180) return 'What can go wrong: ' + name + ' is young, so its contracts have had little time in the wild and its points program can change. Farm with the planned capital only, and re-check the points page before each new deposit.';
    return 'What can go wrong: the contract can hold a bug no audit caught, and the points program can change before launch. Keep the position to the planned capital, and treat every deposit as money you can afford to lose.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var fast = p.change_7d !== null && p.change_7d !== undefined && p.change_7d > 15;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: 'about $' + (capital >= 150 ? 6 : 3) + ' of gas', time: '10 minutes' },
      { text: fast ? 'Act twice a week while ' + p.name + "'s TVL is growing fast, such as a deposit, a swap or a vote." : 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', cost: fast ? 'about $4 of gas a week' : 'about $2 of gas a week', time: fast ? '15 minutes a week' : '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open " + p.name + "'s own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, and plan the unwind in two steps so you can exit without losing the position\'s history.', cost: 'nothing but the log', time: '5 minutes' },
      { text: chainStepFor(p, capital, chain), cost: 'about $3 of gas for the bridge or swap', time: '15 minutes' },
      { text: riskStepFor(p), cost: 'nothing to check, and never pay to remove a risk', time: '10 minutes' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'multiple') { av = a.base_multiple; bv = b.base_multiple; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor, every one the watchlist rule would keep. Implied value is a model, not a promise: each multiple below comes from the market, not from a list.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtMult(r.base_multiple) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x category_multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + 0.02 x min(chains - 1, 10)) x momentum_tier(change_7d) x (1 + 0.10 x category_tvl_share) )'
      ),
      el('p', { class: 'sub', text: 'Three further factors refine the estimate. Momentum is a tier on the same seven-day growth: cooling below -20% counts 0.92x, flat to 0 counts 0.97x, warming to +10% counts 1.03x, hot to +30% counts 1.08x, and surging above +30% counts 1.14x. Concentration is 1 + 0.10 times the protocol\u2019s share of its category\u2019s TVL, at most 1.10x: the protocol that dominates its category earns a small premium for the network effects that dominance implies. The confidence band is the 25th-to-75th-percentile spread of the category\u2019s peer multiples applied to the same factors, clipped to contain the point estimate, so a category whose peers agree reads as a tight band and one whose peers disagree reads as a wide band.' }),
      el('p', { class: 'sub', text: 'The category multiple is the median market-cap-to-TVL multiple of the snapshot\u2019s own tokened protocols in that category, each peer multiple winsorised at ' + m.peer_cap + 'x, shrunk toward the global median of ' + DATA.global_median + 'x with ' + m.shrink_prior + ' peers\u2019 worth of prior, floored at ' + m.multiple_floor + 'x and capped at ' + m.multiple_cap + 'x. A category with no tokened peers takes the global median. TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. The early radar is every pre-token protocol below the watchlist floor that the watchlist rule would keep, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  function calibrationPanel() {
    var inBoard = new Set(DATA.rows.map(function (r) { return r.category || ''; }));
    var shown = DATA.calibration.filter(function (c) { return inBoard.has(c.category); });
    shown.sort(function (a, b) { return b.applied - a.applied || (a.category < b.category ? -1 : 1); });
    var tbody = el('tbody');
    shown.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('b', { text: c.category || 'Uncategorised' })),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: c.median === null ? 'no peers' : fmtMult(c.median) }),
        el('td', { class: 'num', text: fmtMult(c.applied) }),
        el('td', { class: 'sub', text: c.peers === 0 ? 'global median' : c.peers + ' tokened peer' + (c.peers === 1 ? '' : 's') + ', shrunk toward ' + DATA.global_median + 'x' })
      ));
    });
    return el('section', { class: 'panel calibration' },
      el('h2', { text: 'Where each multiple comes from' }),
      el('p', { class: 'sub', text: 'One row per category on the board. The median is the category\u2019s own tokened protocols; the applied multiple is that median shrunk toward the global median, floored at ' + DATA.model.multiple_floor + 'x and capped at ' + DATA.model.multiple_cap + 'x. Nothing here is typed in by hand.' }),
      el('p', { class: 'sub', text: 'The momentum tier, the concentration premium and the confidence band are per-row, not per-category: open any protocol to see its own tier, its share of its category\u2019s TVL and the band the peer spread gives it. A wide band means the category\u2019s own tokened protocols disagree about what a dollar of TVL is worth, so the estimate for that row is less certain than a row with a tight band.' }),
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Category' }),
            el('th', { scope: 'col', class: 'num', text: 'Peers' }),
            el('th', { scope: 'col', class: 'num', text: 'Peer median' }),
            el('th', { scope: 'col', class: 'num', text: 'Applied multiple' }),
            el('th', { scope: 'col', text: 'Basis' })
          )),
          tbody
        )
      )
    );
  }

  function moversPanel() {
    var movers = DATA.rows.filter(function (r) { return r.change_7d !== null && r.change_7d !== undefined; })
      .slice().sort(function (a, b) { return b.change_7d - a.change_7d; }).slice(0, 8);
    var items = movers.map(function (r) {
      return el('li', { class: 'mover' },
        el('span', { class: 'num', text: String(r.rank) }),
        el('b', { text: r.name }),
        el('span', { class: 'sub', text: r.category || 'Other' }),
        el('span', { class: 'num pos', text: fmtPct(r.change_7d) }),
        el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
      );
    });
    return el('section', { class: 'panel movers' },
      el('h2', { text: 'Top movers (7d)' }),
      el('p', { class: 'sub', text: 'The fastest-growing pre-token protocols by seven-day TVL change. Growth already feeds the model twice: once in the linear growth multiplier and once in the momentum tier, so a mover here is one the model has already noticed.' }),
      el('ol', { class: 'mover-list' }, items)
    );
  }

  function categoryPanel() {
    var totals = {};
    DATA.rows.forEach(function (r) {
      var key = r.category || 'Other';
      if (!totals[key]) totals[key] = { value: 0, count: 0 };
      totals[key].value += r.implied_value_usd;
      totals[key].count += 1;
    });
    var entries = Object.keys(totals).map(function (k) { return { category: k, value: totals[k].value, count: totals[k].count }; });
    entries.sort(function (a, b) { return b.value - a.value; });
    var max = entries.length ? entries[0].value : 1;
    var items = entries.map(function (e) {
      return el('li', { class: 'cat-row' },
        el('span', { class: 'cat-name', text: e.category }),
        el('span', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((e.value / max) * 100)) + '%' })),
        el('span', { class: 'num', text: fmtUsd(e.value) }),
        el('span', { class: 'sub', text: e.count + ' protocol' + (e.count === 1 ? '' : 's') })
      );
    });
    return el('section', { class: 'panel categories' },
      el('h2', { text: 'Where the implied value sits' }),
      el('p', { class: 'sub', text: 'Total implied value by category across the whole board. A tall bar means the category holds many large pre-token protocols, not that any one of them is the best farm: open the category in the board to see its rows.' }),
      el('ul', { class: 'cat-list' }, items)
    );
  }

  function methodologyPanel() {
    return el('section', { class: 'panel methodology' },
      el('h2', { text: 'How to read this radar' }),
      el('p', { text: 'Token Radar asks one question: if this protocol launched a token today, what would it be worth? It answers with comparables, the same way a buyer values a company against its listed peers. For each category it takes the market-cap-to-TVL multiples of the protocols in that category that already trade, takes the median, and shrinks that median toward the global median so a category with one or two peers does not set a wild multiple. That multiple times the protocol\u2019s TVL is the starting value.' }),
      el('p', { text: 'Four adjustments follow. Growth: a protocol whose TVL rose in the last seven days is worth more than one whose TVL fell, and the momentum tier rewards fast growth a second time. Maturity: a protocol that has run for years with no token is worth more than one listed last month, because survival is evidence. Breadth: a protocol live on several chains is worth a little more than one on a single chain. Concentration: a protocol that holds a large share of its category\u2019s TVL earns a small premium for the network effects that dominance implies.' }),
      el('p', { text: 'The confidence band says how sure the model is. It comes from the spread of the category\u2019s own peer multiples: when the peers agree, the band is tight; when they disagree, the band is wide, and the point estimate is less certain. A wide band is not a bad protocol, it is a category the market has not priced consistently.' }),
      el('p', { text: 'The farm plan is a separate thing from the value. It is a checklist for earning a future allocation: use a fresh wallet, deposit the planned capital, repeat the action on a second chain where the protocol runs, act weekly while growth is fast, hold long enough to be counted in more than one snapshot, and claim only from the protocol\u2019s own page. The last step of every plan names what can go wrong for that protocol, because a farm that ignores its own risk is not a plan.' }),
      el('p', { class: 'sub', text: 'Implied value is an estimate, not a price and not a promise. The snapshot is one day, the multiples are medians, and a token launch can be worth far more or far less than the model says.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    var peerNote = row.peers === 0
      ? 'no tokened peers in ' + (row.category || 'this category') + '; the global median ' + fmtMult(DATA.global_median) + ' applies'
      : 'median ' + fmtMult(row.category_median) + ' from ' + row.peers + ' tokened peer' + (row.peers === 1 ? '' : 's') + ', shrunk toward the global median';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple (' + (row.category || 'uncategorised') + ')' }), el('b', { class: 'num', text: fmtMult(row.base_multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains' }), el('b', { class: 'num', text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { class: 'num', text: String(row.breadth_multiplier) })),
        el('div', null, el('span', { text: 'Momentum tier' }), el('b', { class: 'num', text: row.momentum_tier || 'n/a' })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: row.momentum_multiplier === null || row.momentum_multiplier === undefined ? 'n/a' : String(row.momentum_multiplier) })),
        el('div', null, el('span', { text: 'Share of category TVL' }), el('b', { class: 'num', text: row.category_tvl_share === null || row.category_tvl_share === undefined ? 'n/a' : (row.category_tvl_share * 100).toFixed(1) + '%' })),
        el('div', null, el('span', { text: 'Concentration multiplier' }), el('b', { class: 'num', text: row.concentration_multiplier === null || row.concentration_multiplier === undefined ? 'n/a' : String(row.concentration_multiplier) })),
        el('div', null, el('span', { text: 'Confidence band' }), el('b', { class: 'num', text: fmtUsd(row.confidence_low_usd) + ' \u2013 ' + fmtUsd(row.confidence_high_usd) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': ' + peerNote + '. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' The confidence band is the 25th-to-75th-percentile spread of the category\u2019s peer multiples around this estimate. This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(moversPanel());
      shell.appendChild(categoryPanel());
      shell.appendChild(modelPanel());
      shell.appendChild(calibrationPanel());
      shell.appendChild(methodologyPanel());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
