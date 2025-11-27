# ChatBet Playwright Assessment (JS)

## Resumen en 1 frase
Proyecto con pruebas E2E automatizadas usando Playwright Request para validar flujos de apuestas contra la API mock.

## Requisitos
- Node 18+ recomendado
- npm

## Instalación (hacer exacto)
1. Abre una terminal en la carpeta del proyecto.
2. Ejecuta:
   ```bash
   npm install
   npx playwright install
   ```
   Esto instala Playwright y las dependencias.

## Estructura del proyecto
```
chatbet-playwright/
├─ configs/
├─ src/
├─ tests/
├─ playwright.config.js
├─ package.json
├─ README.md
├─ TEST_PLAN.md
└─ DESIGN.md
```

## Ejecutar tests
- Correr todos los tests:
  ```bash
  npm test
  ```
- Abrir el reporte HTML:
  ```bash
  npm run show-report
  ```

## Cambiar parámetros
- Edita `configs/*.json` según quieras (sport_id, stake, selections).
- Luego vuelve a correr `npm test`.

## Notas técnicas (explicado simple)
- Uso `decimal.js` para cálculos con dinero (evita errores de coma flotante).
- Los tests usan `src/apiClient.js` como cliente HTTP centralizado.
- Reporte en `playwright-report/`.
