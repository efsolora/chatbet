import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }]
  ],

  projects: [
  {
    name: 'api-tests',
    use: {
      baseURL: process.env.BASE_URL || 'https://v46fnhvrjvtlrsmnismnwhdh5y0lckdl.lambda-url.us-east-1.on.aws',
      ignoreHTTPSErrors: true,
      actionTimeout: 15000
    }
  }
]

});
