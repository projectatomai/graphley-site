#!/bin/bash
# Usage: tools/set-release.sh VERSION BUILD SHA256 BYTES
# Points every download link, version, build, size and checksum on the site at
# downloads/Graphley-VERSION.dmg: the download page, the home page, the JSON-LD on every
# page (softwareVersion and downloadUrl) and llms.txt. Run by graphley/scripts/release-mac.sh
# after it copies the DMG and appcast.xml here. SHA256 and BYTES may be "pending" for a
# placeholder; otherwise the staged DMG must exist and match both.
set -euo pipefail
usage='Usage: tools/set-release.sh VERSION BUILD SHA256 BYTES'
version="${1:?$usage}" build="${2:?$usage}" sha="${3:?$usage}" bytes="${4:?$usage}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'VERSION must look like 1.2.3.' >&2; exit 1; }
[[ "$build" =~ ^[0-9]+$ ]] || { echo 'BUILD must be a whole number.' >&2; exit 1; }
[[ "$sha" =~ ^[0-9a-f]{64}$ || "$sha" == pending ]] || { echo 'Pass the 64-character SHA-256 of the DMG, or "pending".' >&2; exit 1; }
[[ "$bytes" =~ ^[0-9]+$ || "$bytes" == pending ]] || { echo 'BYTES must be the DMG size in bytes, or "pending".' >&2; exit 1; }
cd "$(dirname "$0")/.."

dmg="downloads/Graphley-$version.dmg"
if [[ "$sha" != pending ]]; then
  [[ -f "$dmg" ]] || { echo "Stage $dmg first." >&2; exit 1; }
  [[ "$(shasum -a 256 "$dmg" | cut -d' ' -f1)" == "$sha" ]] || { echo "Checksum does not match $dmg." >&2; exit 1; }
fi
if [[ "$bytes" != pending && -f "$dmg" ]]; then
  [[ "$(stat -f %z "$dmg" 2>/dev/null || stat -c %s "$dmg")" == "$bytes" ]] || { echo "Size does not match $dmg." >&2; exit 1; }
fi

# Size as Finder shows it (decimal megabytes).
if [[ "$bytes" == pending ]]; then size='Size pending'; else size="$(awk -v b="$bytes" 'BEGIN { printf "%.1f MB", b / 1000000 }')"; fi

files=(index.html download/index.html mcp/index.html help/index.html privacy/index.html 404.html llms.txt)
export version build sha size
perl -0pi -e '
  s/Graphley-\d+\.\d+\.\d+\.dmg/Graphley-$ENV{version}.dmg/g;
  s/(data-release="version">)[^<]*/${1}$ENV{version}/g;
  s/(data-release="build">)[^<]*/${1}$ENV{build}/g;
  s/(data-release="size">)[^<]*/${1}$ENV{size}/g;
  s/(data-release="sha">)[^<]*/${1}$ENV{sha}/g;
  s/"softwareVersion":"[^"]*"/"softwareVersion":"$ENV{version}"/g;
  s/^(- Current release: Graphley )\S+ \(build \d+\), [^.]*(?:\.\d+ MB)?\. SHA-256: \S+$/${1}$ENV{version} (build $ENV{build}), $ENV{size}. SHA-256: $ENV{sha}/m;
' "${files[@]}"

grep -c "Graphley-$version.dmg" download/index.html >/dev/null || { echo 'The download page has no link to the DMG.' >&2; exit 1; }
echo "Site points at $dmg (version $version, build $build, $size, SHA-256 $sha)."
grep -n "data-release=\"\(version\|build\|size\|sha\)\"" download/index.html | sed -E 's/^([0-9]+):.*(data-release="[a-z]+">[^<]*).*/  download\/index.html:\1 \2/'
grep -n '^- Current release' llms.txt
