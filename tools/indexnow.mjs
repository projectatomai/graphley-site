#!/usr/bin/env node
// Tells IndexNow which pages changed in this deploy, so Bing (and the assistants that
// search through it, such as Copilot and ChatGPT) re-read them within minutes instead of days.
//
// It runs at the end of a Cloudflare Pages build. For every URL in the built sitemap it compares the
// page's words (title, description, structured data and visible text) with the page that is
// live right now, and submits only the pages that differ, plus pages that were added or removed.
// With --lastmod it also writes <lastmod> into the built sitemap: today for a changed page,
// otherwise the date the live sitemap (or the committed one) already shows.
//
// Production deploys submit. Preview deploys only print what they would submit.
// Local builds do nothing. It never fails a build.
//
// Usage: node indexnow.mjs <built sitemap> <built html dir> [more dirs...] [--lastmod]
// The key below is public by design: IndexNow checks it against /<key>.txt on the site.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = '66365049776433ceca35572e03fca658';
const ENDPOINT = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';
const mode = process.env.VERCEL_ENV || (process.env.CF_PAGES ? (process.env.CF_PAGES_BRANCH === 'main' ? 'production' : 'preview') : undefined); // production | preview | undefined (local)

const args = process.argv.slice(2);
const withLastmod = args.includes('--lastmod');
const [sitemapFile, ...dirs] = args.filter((arg) => arg !== '--lastmod');

const locs = (xml) => [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, entry]) => ({
  loc: (entry.match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1],
  lastmod: (entry.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/) || [])[1],
})).filter((entry) => entry.loc);

// What a page says, without markup, scripts or asset file names, so a rebuild alone is not a change.
// The robots tag is left out: preview builds set noindex, and a noindex page is not in the sitemap anyway.
export const words = (html) => {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => tag)
    .filter((tag) => /(?:name|property)=["'](?:description|og:title|og:description)["']/i.test(tag))
    .map((tag) => (tag.match(/content=(?:"([^"]*)"|'([^']*)')/i) || []).slice(1).find(Boolean) || '');
  const data = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(([, json]) => json);
  const text = html
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return [title, ...meta, ...data, text].join(' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
};

const builtPage = (url) => {
  const path = decodeURIComponent(new URL(url).pathname).replace(/\/+$/, '');
  for (const dir of dirs) {
    for (const file of path ? [`${path}.html`, `${path}/index.html`] : ['/index.html']) {
      if (existsSync(join(dir, file))) return readFileSync(join(dir, file), 'utf8');
    }
  }
  return null;
};

const get = async (url) => {
  const target = process.env.INDEXNOW_TEST_ORIGIN ? url.replace(/^https?:\/\/[^/]+/, process.env.INDEXNOW_TEST_ORIGIN) : url;
  const response = await fetch(target, { signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'indexnow-build-check' } });
  return { status: response.status, body: response.status === 200 ? await response.text() : '' };
};

async function main() {
  if (!mode || !sitemapFile || !existsSync(sitemapFile)) return;
  const xml = readFileSync(sitemapFile, 'utf8');
  const pages = locs(xml);
  if (!pages.length) return;
  const origin = new URL(pages[0].loc).origin;

  const liveSitemap = await get(`${origin}/sitemap.xml`).catch(() => ({ status: 0, body: '' }));
  const live = new Map(locs(liveSitemap.body).map((entry) => [entry.loc, entry.lastmod]));

  const changed = [];
  const skipped = [];
  for (let start = 0; start < pages.length; start += 8) {
    await Promise.all(pages.slice(start, start + 8).map(async ({ loc }) => {
      const built = builtPage(loc);
      if (built === null) return skipped.push(`${loc} (not built as a file)`);
      const now = await get(loc).catch(() => null);
      if (now && now.status === 404) return changed.push(loc); // new page
      if (!now || now.status !== 200) return skipped.push(`${loc} (live page did not load)`);
      if (words(built) !== words(now.body)) changed.push(loc);
    }));
  }
  // A page that left the sitemap is submitted too, so it drops out of the index.
  const removed = liveSitemap.status === 200 ? [...live.keys()].filter((loc) => !pages.some((page) => page.loc === loc)) : [];

  if (withLastmod) {
    const today = new Date().toISOString().slice(0, 10);
    const dated = xml.replace(/<url>([\s\S]*?)<\/url>/g, (entry, inner) => {
      const loc = (inner.match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1];
      const committed = (inner.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/) || [])[1];
      const date = changed.includes(loc) ? today : live.get(loc) || committed;
      const bare = inner.replace(/\s*<lastmod>[\s\S]*?<\/lastmod>/, '');
      return `<url>${date ? bare.replace(/<\/loc>/, `</loc><lastmod>${date}</lastmod>`) : bare}</url>`;
    });
    writeFileSync(sitemapFile, dated);
  }

  const urlList = [...changed, ...removed];
  for (const note of skipped) console.log(`IndexNow: skipped ${note}`);
  if (!urlList.length) return console.log(`IndexNow: no page changed (${pages.length} checked).`);
  console.log(`IndexNow: ${urlList.length} of ${pages.length} page(s) changed:\n  ${urlList.join('\n  ')}`);
  if (mode !== 'production') return console.log('IndexNow: preview build, nothing submitted.');

  const host = new URL(origin).host;
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${origin}/${KEY}.txt`, urlList }),
  });
  console.log(`IndexNow: submitted, HTTP ${response.status}.`);
}

main().catch((error) => console.log(`IndexNow: skipped (${error.message}).`));
