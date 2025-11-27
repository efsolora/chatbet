# TEST_PLAN.md

## Objetivo
Validar integración con ChatBet Mock API mediante tests E2E parametrizables que cubran flujos de apuesta simple, combo y manejo de errores.

## Endpoints clave
- `POST /auth` — generar token
- `GET  /balance` — obtener saldo
- `GET  /fixtures` — buscar fixtures
- `GET  /odds` — obtener cuotas
- `POST /place-bet` — colocar apuesta simple
- `POST /add-bet-to-combo` — agregar selección a combo
- `POST /get-combo-odds` — obtener odds del combo
- `POST /place-combo-bet` — colocar combo bet

## Casos principales
| ID   | Descripción                    | Prioridad | Tipo       |
|------|--------------------------------|-----------|------------|
| TC01 | Simple Bet E2E                 | Alta      | Positivo   |
| TC02 | Simple Bet - saldo insuf.      | Media     | Negativo   |
| TC03 | Combo Bet E2E                  | Alta      | Positivo   |
| TC04 | Combo - validación de odds     | Alta      | Positivo   |
| TC05 | Error flow (fixture no existe) | Media     | Negativo   |

## Parametrización
- Archivos en `configs/*.json`.
- Variables: `sport_id`, `tournament_id`, `market_type`, `stake`, `selections[]`, `tolerance`.

## Criterios de aceptación
- Tests independientes.
- Reporte HTML/JSON con tests ejecutados/pasados/fallidos, tiempo, detalles de fallo y parámetros usados.
- Cálculos monetarios con `decimal.js`.
