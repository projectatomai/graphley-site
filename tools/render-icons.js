// Renders mark.svg (the Graphley app icon) to the site's PNG icons.
// Run from the repository root: node tools/render-icons.js [out-dir-for-sibling-icons]
// Writes assets/icon.png (512, rounded), favicon.png (64, rounded), assets/apple-touch-icon.png
// (180, square; iOS rounds it). With an out dir it also writes graphley-96.png and graphley-144.png
// for the More from Protomota blocks and protomota.com (convert the 96 to WebP with cwebp).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'mark.svg'), 'utf8');
const rounded = (size) => `<html><body style="margin:0;background:transparent">
  <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${size * 0.92}px;height:${size * 0.92}px;border-radius:${size * 0.92 * 0.225}px;overflow:hidden;box-shadow:0 ${size * 0.01}px ${size * 0.02}px rgba(11,27,33,.28)">
      ${svg.replace('<svg ', '<svg style="display:block;width:100%;height:100%" ')}
    </div></div></body></html>`;
const square = (size) => `<html><body style="margin:0">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`;
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
  const shot = async (html, size, file) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(html);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
  };
  await shot(rounded(512), 512, path.join(root, 'assets/icon.png'));
  await shot(rounded(64), 64, path.join(root, 'favicon.png'));
  await shot(square(180), 180, path.join(root, 'assets/apple-touch-icon.png'));
  const out = process.argv[2];
  if (out) {
    await shot(rounded(96), 96, path.join(out, 'graphley-96.png'));
    await shot(rounded(144), 144, path.join(out, 'graphley-144.png'));
  }
  await browser.close();
})();
