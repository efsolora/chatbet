// tests/error-flow.spec.js
import { test, expect } from '@playwright/test';
import ApiClient from '../src/apiClient';
import { loadConfig } from '../src/helpers';

test('Error validation flow', async () => {
  const config = loadConfig('error_flow.json');
  const baseURL = test.info().project.use.baseURL;
  const api = new ApiClient(baseURL);

  const auth = await api.authenticate();
  expect(auth && auth.token).toBeTruthy();
  const token = auth.token;

  // 1. Fixture no existe -> se espera respuesta vacía o error controlado
  let fixtureOk = true;
  try {
    const fixtures = await api.findFixture(config.sport_id, config.tournament_id);
    if (!fixtures || (Array.isArray(fixtures) && fixtures.length === 0) || (fixtures.items && fixtures.items.length === 0)) {
      fixtureOk = false;
    }
  } catch (e) {
    fixtureOk = false;
  }
  expect(fixtureOk).toBeFalsy();

  // 2. Intentar colocar apuesta con stake enorme -> debe fallar (saldo insuf.)
  const placeRes = await api.placeBet(token, { fixture_id: 1, market: '1X2', stake: config.stake });
  // esperamos no-ok
  expect(placeRes.ok).toBeFalsy();
  expect([400, 402, 403, 422]).toContain(placeRes.status);
});
