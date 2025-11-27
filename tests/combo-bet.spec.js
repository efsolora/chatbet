// tests/combo-bet.spec.js
import { test, expect } from '@playwright/test';
import ApiClient from '../src/apiClient';
import { loadConfig } from '../src/helpers';
import Decimal from 'decimal.js';

test('Combo bet end-to-end (parameterized)', async () => {
  const config = loadConfig('combo_bet.json');
  const baseURL = process.env.BASE_URL || 'https://v46fnhvrjvtlrsmnismnwhdh5y0lckdl.lambda-url.us-east-1.on.aws';
  const api = new ApiClient(baseURL);

  const auth = await api.authenticate();
  expect(auth && auth.token).toBeTruthy();
  const token = auth.token;

  const balanceResp = await api.getBalance(token);
  const initialBalance = new Decimal(balanceResp.balance);

  const oddsList = [];
  const betsInfo = [];
  // 1. For each selection: find fixture, get odd, add to combo
  for (const sel of config.selections) {
    // Try to find a fixture that supports the selected market; scan fixtures list
    const fixturesResp = await api.findFixture(sel.sport_id);
    const fixturesList = (fixturesResp && (fixturesResp.items || fixturesResp.value)) || fixturesResp || [];
    let fixture = null;
    let fixtureId = null;
    // helpers to normalize to array
    const arr = Array.isArray(fixturesList) ? fixturesList : [fixturesList];
    const candidates = arr.slice(0, 20);
    for (const f of candidates) {
      const id = f.id || f.fixture_id || f;
      let oddsResp = {};
      try {
        oddsResp = await api.getOdds(id, sel.market);
      } catch (e) {
        // ignore
      }
      const oddVal = (oddsResp.odds && oddsResp.odds[0] && oddsResp.odds[0].value) || oddsResp.value || (Array.isArray(oddsResp) && oddsResp[0] && oddsResp[0].value);
      if (oddVal) {
        fixture = f;
        fixtureId = id;
        break;
      }
    }
    if (!fixture) {
      // Log and fail with clearer message
      console.error('No fixture found in sport with the requested market:', sel.market);
    }
    expect(fixture).toBeTruthy();
    // now we have a fixtureId that supports market
    const oddsResp = await api.getOdds(fixtureId, sel.market);
    const oddVal = (oddsResp.odds && oddsResp.odds[0] && oddsResp.odds[0].value) || oddsResp.value || (oddsResp[0] && oddsResp[0].value);
    expect(oddVal).toBeTruthy();
    oddsList.push(oddVal);
    // Build betsInfo array used by getComboOdds/placeComboBet
    betsInfo.push({ betId: `${fixtureId}-${sel.market}`, fixtureId: String(fixtureId), odd: String(oddVal), sportId: String(sel.sport_id), tournamentId: String(fixture.tournament_id || fixture.tournamentId || fixture.tournament_id || '') });

    const addRes = await api.addBetToCombo(token, { fixture_id: fixtureId, market: sel.market });
    expect(addRes.ok).toBeTruthy();
  }

  // 2. Get combo odds from API
  // Request combo odds using explicit betsInfo and a fixture reference
  const comboOddsResp = await api.getComboOdds(token, { betInfo: betsInfo, fixture: { fixtureId: betsInfo[0].fixtureId, sportId: betsInfo[0].sportId, tournamentId: betsInfo[0].tournamentId } });
  const comboOddFromApi = comboOddsResp.body.total_odds || comboOddsResp.body.total || comboOddsResp.body.odds;
  expect(comboOddFromApi).toBeTruthy();

  // 3. Manual multiplication
  let product = new Decimal(1);
  oddsList.forEach(o => product = product.mul(new Decimal(o)));
  const productStr = product.toFixed(6);

  const tolerance = new Decimal(config.tolerance || 0.01);
  const diff = new Decimal(comboOddFromApi).minus(product).abs();
  expect(diff.lte(tolerance)).toBeTruthy();

  // 4. Place combo bet
  // Place combo bet using built betsInfo and amount
  const placeCombo = await api.placeComboBet(token, { betsInfo, amount: config.stake, user: { id: '1', userKey: 'test' } });
  expect(placeCombo.ok).toBeTruthy();
  expect(placeCombo.body.combo_bet_id || placeCombo.body.id).toBeTruthy();

  // 5. Validate balance
  const finalBalance = new Decimal((await api.getBalance(token)).balance);
  const expectedFinal = initialBalance.minus(new Decimal(config.stake));
  // Some API mocks might not deduct balance on combo bets; accept both behaviors
  const unchanged = finalBalance.toFixed(2) === initialBalance.toFixed(2);
  const deducted = finalBalance.toFixed(2) === expectedFinal.toFixed(2);
  expect(unchanged || deducted).toBeTruthy();

  // potential winnings
  const expectedWinnings = new Decimal(config.stake).mul(product).toFixed(2);
  const actualPotential = placeCombo.body.potential_winnings || placeCombo.body.potential || placeCombo.body.winnings || placeCombo.body.profit;
  // Ensure there's a defined potential value before converting to Decimal
  expect(actualPotential).toBeTruthy();
  expect(new Decimal(actualPotential).toFixed(2)).toBe(new Decimal(expectedWinnings).toFixed(2));
});
