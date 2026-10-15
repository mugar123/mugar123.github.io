#!/usr/bin/env bash
# Copies Latin Modern Roman and JetBrains Mono into public/fonts.
# Latin Modern is subsetted to WOFF2 with fonttools (pyftsubset).
# Source is the TypoPRO *DTP* package: the WEB package's fonts are pre-subsetted to Latin-1 and lack
# dashes, curly quotes and the ellipsis, which Markdown smartypants emits in every post.
# public/fonts/LICENSE-latin-modern.txt is committed by hand (GUST Font License, LM 2.004): the DTP
# package ships no license file.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/fonts
mkdir -p "$OUT"
LM=node_modules/@typopro/dtp-latin-modern
JB=node_modules/@fontsource/jetbrains-mono/files

# Use the project venv if present, so `npm run fonts` works without touching PATH.
if [ -x .venv/bin/pyftsubset ]; then PATH="$PWD/.venv/bin:$PATH"; fi
if ! command -v pyftsubset >/dev/null 2>&1; then
  echo "pyftsubset not found. Install: python3 -m venv .venv && .venv/bin/pip install fonttools brotli" >&2
  exit 1
fi

cp node_modules/@fontsource/jetbrains-mono/LICENSE "$OUT/LICENSE-jetbrains-mono.txt"
cp "$JB/jetbrains-mono-latin-400-normal.woff2" "$OUT/jetbrains-mono-400.woff2"

UNICODES="U+0020-007E,U+00A0-00FF,U+00A7,U+2013-2014,U+2018-201D,U+2026,U+2192,U+221A,U+2080-2089"
# Portable loop (macOS ships bash 3.2, which has no associative arrays).
for pair in Regular:lmroman-400 Italic:lmroman-400-italic Bold:lmroman-700; do
  style="${pair%%:*}"
  src="$LM/TypoPRO-LatinModernRoman-$style.ttf"
  dst="$OUT/${pair#*:}"
  pyftsubset "$src" --flavor=woff2 --unicodes="$UNICODES" --layout-features='*' --output-file="$dst.woff2"
done
ls -la "$OUT"
