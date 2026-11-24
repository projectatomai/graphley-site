#!/usr/bin/env bash
# Cloudflare Pages build: copies the deployable site into dist/ (everything except tools/,
# functions/, README and dotfiles), then runs IndexNow against the built sitemap.
set -euo pipefail
rm -rf dist && mkdir dist
for f in * ; do
  case "$f" in dist|tools|functions|README.md) continue ;; esac
  cp -R "$f" dist/
done
cp _headers _redirects dist/
node tools/indexnow.mjs dist/sitemap.xml dist --lastmod
