// Renders tools/social-card.html to social-card.png at 1200 × 630.
// Run from the repository root: node tools/render-social-card.js
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(__dirname, 'social-card.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.resolve(__dirname, '..', 'social-card.png') });
  await browser.close();
})();
