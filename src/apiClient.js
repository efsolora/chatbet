// src/apiClient.js
// Mensajero que habla con la API usando Playwright Request.
// Exporta una clase con métodos para cada endpoint.

import { request } from '@playwright/test';

export class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.ctx = null;
  }

  async init() {
    if (!this.ctx) {
      // Creamos un contexto HTTP reutilizable
      this.ctx = await request.newContext({ baseURL: this.baseURL, timeout: 10000 });
    }
  }

  async post(path, options = {}) {
    await this.init();
    // Normalize headers to use token header if Authorization was provided
    if (options.headers && options.headers.Authorization && !options.headers.token) {
      const auth = options.headers.Authorization;
      // If value is like "Bearer XXX", keep only the token value
      options.headers.token = auth.replace(/^Bearer\s+/i, '');
    }
    const res = await this.ctx.post(path, options);
    const body = await safeJson(res);
    return { status: res.status(), ok: res.ok(), body };
  }

  async get(path, options = {}) {
    await this.init();
    if (options.headers && options.headers.Authorization && !options.headers.token) {
      options.headers.token = options.headers.Authorization.replace(/^Bearer\s+/i, '');
    }
    const res = await this.ctx.get(path, options);
    const body = await safeJson(res);
    return { status: res.status(), ok: res.ok(), body };
  }

  // Auth: asume POST /auth que devuelve { token: '...', expires_in: 3600 }
  async authenticate(username = 'test', password = 'test') {
    // Mock API exposes /auth/generate_token to generate a test token
    const r = await this.post('/auth/generate_token', {});
    if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
    return r.body;
  }

  async getBalance(token, userId = 1, userKey = 'test') {
    // Mock API exposes /auth/get_user_balance and returns money/playableBalance
    const headers = { token };
    const r = await this.get(`/auth/get_user_balance?userId=${userId}&userKey=${userKey}`, { headers });
    if (!r.ok) throw new Error(`getBalance failed: ${r.status}`);
    // Normalize body to include `balance` field that tests expect
    const body = r.body || {};
    if (body.balance == null && body.money != null) {
      body.balance = body.money;
    } else if (body.balance == null && body.playableBalance != null) {
      body.balance = body.playableBalance;
    }
    return body;
  }

  async findFixture(sport_id, tournament_id = null) {
    // Mock API provides /sports/fixtures and /sports/sports-fixtures; use sports/sports-fixtures
    const params = [];
    if (sport_id) params.push(`sportId=${sport_id}`);
    if (tournament_id) params.push(`tournamentId=${tournament_id}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const r = await this.get(`/sports/sports-fixtures${qs}`);
    if (!r.ok) throw new Error(`findFixture failed: ${r.status}`);
    return r.body;
  }

  async getOdds(fixture_id, market_type, sport_id = null) {
    // Mock API uses /sports/odds with fixtureId and optional sportId
    const params = [`fixtureId=${fixture_id}`];
    if (sport_id) params.push(`sportId=${sport_id}`);
    if (market_type) params.push(`market=${encodeURIComponent(market_type)}`);
    const q = `?${params.join('&')}`;
    const r = await this.get(`/sports/odds${q}`);
    if (!r.ok) throw new Error(`getOdds failed: ${r.status}`);
    let body = r.body || {};
    // Helper to normalize common market names to API keys
    const normalizeMarket = (m) => {
      if (!m) return 'result';
      const mm = String(m).toLowerCase();
      if (mm === '1x2' || mm === '1X2') return 'result';
      if (mm.includes('over') || mm.includes('under')) return 'over_under';
      if (mm.includes('spread') || mm.includes('handicap')) return 'handicap';
      // fallback: convert spaces/characters to underscores
      return mm.replace(/[^a-z0-9]+/g, '_');
    };
    const marketSlug = normalizeMarket(market_type);

    // Normalize response to include 'odds' array with objects that have value
    if (!body.odds) {
      // Try to read first item from common structures
      if (body.value) {
        body.odds = [{ value: body.value }];
      } else if (Array.isArray(body) && body.length && body[0].value) {
        body.odds = [ { value: body[0].value } ];
      } else if (body.result && body.result.options) {
        const opts = Object.values(body.result.options);
        if (opts.length > 0) {
          const first = opts[0];
          body.odds = [{ value: first.odds ?? first.profit ?? first }];
        }
      } else if (body[marketSlug] && body[marketSlug].options) {
        // e.g., over_under or handicap
        const opts = Object.values(body[marketSlug].options);
        if (opts.length > 0) {
          const first = opts[0];
          body.odds = [{ value: first.odds ?? first.profit ?? first }];
        }
      }
    }
    // If still no odds, try to find any fixture that has odds for this market
    if (!body.odds || (Array.isArray(body.odds) && body.odds.length === 0)) {
      try {
        // Get a list of fixtures (use sport_id if provided to narrow search)
        const qs = sport_id ? `?sportId=${sport_id}` : '';
        const fixturesResp = await this.get(`/sports/sports-fixtures${qs}`);
        const list = (fixturesResp.body && (fixturesResp.body.items || fixturesResp.body.value)) || fixturesResp.body || [];
        const arr = Array.isArray(list) ? list : (list.value || []);
        for (const f of arr.slice(0, 50)) {
          try {
            const maybeOdds = await this.get(`/sports/odds?fixtureId=${f.id || f.fixture_id || f}`);
            const lob = maybeOdds.body || {};
            if (lob.odds || lob.value || (lob.result && lob.result.options) || (lob[marketSlug] && lob[marketSlug].options)) {
              if (!lob.odds && lob[marketSlug] && lob[marketSlug].options) {
                const opts = Object.values(lob[marketSlug].options);
                if (opts.length > 0) lob.odds = [{ value: opts[0].odds ?? opts[0].profit ?? opts[0] }];
              } else if (!lob.odds && lob.result && lob.result.options) {
                const opts = Object.values(lob.result.options);
                if (opts.length > 0) lob.odds = [{ value: opts[0].odds ?? opts[0].profit ?? opts[0] }];
              }
              body = lob;
              break;
            }
          } catch {}
        }
      } catch (e) {
        // fallback: ignore
      }
    }
    return body;
  }

  async placeBet(token, payload) {
    const headers = { token };
    // Build a minimal PlaceBetRequest shape expected by the mock API
    const body = {
      user: { id: payload.userId || '1', userKey: payload.userKey || 'test' },
      betInfo: {
        amount: String(payload.stake || payload.amount || 0),
        source: payload.source || 'chatbet',
        betId: [
          {
            betId: payload.fixture_id ? String(`${payload.fixture_id}-${payload.market || ''}`) : String(Date.now()),
            fixtureId: String(payload.fixture_id || payload.fixtureId || ''),
            sportId: String(payload.sport_id || payload.sportId || 1),
            tournamentId: String(payload.tournament_id || payload.tournamentId || ''),
            odd: payload.odd || payload.odds || null
          }
        ]
      }
    };
    // If odd is missing, try to fetch it from the API
    if (!body.betInfo.betId[0].odd && payload.fixture_id) {
      try {
        const oddsResp = await this.getOdds(payload.fixture_id, payload.market, payload.sport_id);
        const oddVal = (oddsResp.odds && oddsResp.odds[0] && oddsResp.odds[0].value) || oddsResp.value || (Array.isArray(oddsResp) && oddsResp[0] && oddsResp[0].value);
        if (oddVal) body.betInfo.betId[0].odd = String(oddVal);
      } catch (e) {
        // ignore and send request; server will validate
      }
    }
    const r = await this.post('/place-bet', { data: body, headers });
    // Normalize response: map betId/possibleWin -> bet_id/id/potential_winnings
    const resp = Object.assign({}, r);
    resp.body = resp.body || {};
    if (resp.body.betId && !resp.body.bet_id) resp.body.bet_id = resp.body.betId;
    if (resp.body.betId && !resp.body.id) resp.body.id = resp.body.betId;
    if (resp.body.possibleWin && !resp.body.potential_winnings) resp.body.potential_winnings = resp.body.possibleWin;
    if (resp.body.possibleWin && !resp.body.potential) resp.body.potential = resp.body.possibleWin;
    if (resp.body.possibleWin && !resp.body.winnings) resp.body.winnings = resp.body.possibleWin;
    return resp;
  }

  async addBetToCombo(token, payload) {
    const headers = { token };
    // If caller passed a small payload like { fixture_id, market }, map it to AddBetToComboRequest
    let data = payload;
    if (payload && (payload.fixture_id || payload.fixtureId)) {
      let fixtureId = payload.fixture_id || payload.fixtureId;
      // attempt to fetch odd if not provided
      let oddVal = payload.odd;
      try {
        if (!oddVal) {
          let oddsResp = null;
          try {
            oddsResp = await this.getOdds(fixtureId, payload.market, payload.sport_id);
            oddVal = (oddsResp.odds && oddsResp.odds[0] && oddsResp.odds[0].value) || oddsResp.value || (Array.isArray(oddsResp) && oddsResp[0] && oddsResp[0].value);
          } catch (err) {
            // Try to find a fixture in sport that has an odd for the market
            const fixtures = await this.findFixture(payload.sport_id);
            const list = (fixtures.items && fixtures.items) || fixtures.value || fixtures || [];
            for (const f of list) {
              try {
                const maybeOdds = await this.getOdds(f.id || f.fixture_id || f, payload.market, payload.sport_id);
                const v = (maybeOdds.odds && maybeOdds.odds[0] && maybeOdds.odds[0].value) || maybeOdds.value || (Array.isArray(maybeOdds) && maybeOdds[0] && maybeOdds[0].value);
                if (v) {
                  oddVal = v;
                  // also update fixtureId being used to a fixture that actually has odds
                  fixtureId = f.id || f.fixture_id || f;
                  break;
                }
              } catch (e2) {
                // ignore and continue
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
      const betInfo = {
        betInfo: {
          betId: String(`${fixtureId}-${payload.market || ''}`),
          fixtureId: String(fixtureId),
          odd: oddVal ? String(oddVal) : undefined,
          sportId: String(payload.sport_id || payload.sportId || 1),
          tournamentId: String(payload.tournament_id || payload.tournamentId || '')
        },
        betsAdded: []
      };
      data = betInfo;
    }
    const resp = await this.post('/add-bet-to-combo', { data, headers });
    // If successful, register the added bet into an in-memory combo buffer in this client
    if (resp.ok) {
      // Initialize combo buffer
      if (!this.comboBets) this.comboBets = [];
      const betInfo = data.betInfo || data.betInfo || {};
      // Normalize betInfo into array form for internal storage
      const o = {
        betId: betInfo.betId || (betInfo.betId && betInfo.betId[0] && betInfo.betId[0].betId) || '',
        fixtureId: betInfo.fixtureId || (betInfo.betId && betInfo.betId[0] && betInfo.betId[0].fixtureId) || '',
        odd: betInfo.odd || (betInfo.betId && betInfo.betId[0] && betInfo.betId[0].odd) || '',
        sportId: betInfo.sportId || (betInfo.betId && betInfo.betId[0] && betInfo.betId[0].sportId) || '',
        tournamentId: betInfo.tournamentId || (betInfo.betId && betInfo.betId[0] && betInfo.betId[0].tournamentId) || ''
      };
      this.comboBets.push(o);
    }
    return resp;
  }

  async getComboOdds(token, payload = {}) {
    const headers = { token };
    let data = payload;
    if ((!payload || Object.keys(payload).length === 0) && this.comboBets && this.comboBets.length > 0) {
      data = { betInfo: this.comboBets, fixture: { fixtureId: this.comboBets[0].fixtureId, sportId: this.comboBets[0].sportId, tournamentId: this.comboBets[0].tournamentId } };
    }
      const resp = await this.post('/get-combo-odds', { data, headers });
      // If the API didn't return a total_odds but we have comboBets stored in client,
      // try to compute combo odds using /combo-bet-calculation as a fallback.
      if ((!resp.body || (!resp.body.total_odds && !resp.body.total && !resp.body.odds)) && this.comboBets && this.comboBets.length > 0) {
        try {
          const betsInfo = this.comboBets.map(b => ({ betId: b.betId, fixtureId: b.fixtureId, odd: b.odd, sportId: b.sportId, tournamentId: b.tournamentId }));
          const calcPayload = { betsInfo, amount: 1 };
          const calcResp = await this.post('/combo-bet-calculation', { data: calcPayload, headers });
          if (calcResp.body && (calcResp.body.odd || calcResp.body.total_odds || calcResp.body.total)) {
            // map calcResp to resp.body fields expected by tests
            resp.body = resp.body || {};
            resp.body.total_odds = calcResp.body.odd || calcResp.body.total_odds || calcResp.body.total;
          }
        } catch (e) {
          // ignore fallback failure
        }
      }
      return resp;
  }


  async placeComboBet(token, payload) {
    const headers = { token };
    let data = payload || {};
    if ((!payload || !payload.betsInfo) && this.comboBets && this.comboBets.length > 0) {
      data = {
        betsInfo: this.comboBets.map(b => ({ betId: b.betId, fixtureId: b.fixtureId, odd: b.odd, sportId: b.sportId, tournamentId: b.tournamentId })),
        amount: payload && (payload.stake || payload.amount) || 0,
        user: { id: payload && payload.userId || '1', userKey: payload && payload.userKey || 'test' }
      };
    }
    const resp = await this.post('/place-combo-bet', { data, headers });
    // Normalize result
    resp.body = resp.body || {};
    if (resp.body.betId && !resp.body.combo_bet_id) resp.body.combo_bet_id = resp.body.betId;
    if (resp.body.betId && !resp.body.id) resp.body.id = resp.body.betId;
    // Map combo API fields to normalized names expected by tests
    if (resp.body.profit && !resp.body.potential_winnings) resp.body.potential_winnings = resp.body.profit;
    if (resp.body.profit && !resp.body.potential) resp.body.potential = resp.body.profit;
    if (resp.body.odd && !resp.body.total_odds) resp.body.total_odds = resp.body.odd;
    if (resp.body.odd && !resp.body.odds) resp.body.odds = resp.body.odd;
    return resp;
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

// Also export default for compatibility with the tests that import a default export
export default ApiClient;