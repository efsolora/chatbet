// tests/simple-bet.spec.js
import { test, expect } from '@playwright/test';
import ApiClient from '../src/apiClient';
import { loadConfig, calcPotentialWinnings } from '../src/helpers';
import Decimal from 'decimal.js';

test('Simple bet end-to-end (parameterized)', async () => {
  const config = loadConfig('simple_bet.json');
  const baseURL = test.info().project.use.baseURL;
  const api = new ApiClient(baseURL);

  // 1. Authenticate
  const auth = await api.authenticate();
  expect(auth && auth.token).toBeTruthy();
  const token = auth.token;

  // 2. Get initial balance
  const balanceResp = await api.getBalance(token);
  const initialBalance = new Decimal(balanceResp.balance);

  // 3. Find fixture
  const fixtures = await api.findFixture(config.sport_id, config.tournament_id);
  const fixture = (fixtures.items && fixtures.items[0]) || fixtures[0] || fixtures;
  expect(fixture).toBeTruthy();
  const fixtureId = fixture.id || fixture.fixture_id;

  // 4. Get odds
  const oddsResp = await api.getOdds(fixtureId, config.market_type);
  const oddVal = (oddsResp.odds && oddsResp.odds[0] && oddsResp.odds[0].value) || oddsResp.value || (oddsResp[0] && oddsResp[0].value);
  expect(oddVal).toBeTruthy();

  // 5. Place bet
  const placeRes = await api.placeBet(token, {
    fixture_id: fixtureId,
    market: config.market_type,
    stake: config.stake
  });
  expect(placeRes.ok).toBeTruthy();
  expect(placeRes.body.bet_id || placeRes.body.id).toBeTruthy();

  // 6. Validate updated balance
  const finalBalanceResp = await api.getBalance(token);
  const finalBalance = new Decimal(finalBalanceResp.balance);
  const expectedFinal = initialBalance.minus(new Decimal(config.stake));
  expect(finalBalance.toFixed(2)).toBe(expectedFinal.toFixed(2));

  // Validate potential winnings
  const expectedW = calcPotentialWinnings(config.stake, oddVal);
  const actualPotential = placeRes.body.potential_winnings || placeRes.body.potential || placeRes.body.winnings;
  expect(actualPotential).toBeTruthy();
  expect(new Decimal(actualPotential).toFixed(2)).toBe(new Decimal(expectedW).toFixed(2));
});
