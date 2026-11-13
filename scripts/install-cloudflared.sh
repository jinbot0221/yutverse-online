#!/bin/sh
set -eu
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ "$(uname -s)" != Linux ] || [ "$(uname -m)" != x86_64 ]; then
  echo 'This verified installer supports Linux x86_64. Check macOS compatibility before installing the official Mac build.' >&2
  exit 1
fi
artifact="$repo_dir/.tools/cloudflared-2026.11.0"
expected=51f7c68b57ed7269164075d7e789efce5b59355982f06392deeb037d982a51fd
mkdir -p "$repo_dir/.tools"
if [ ! -f "$artifact" ]; then
  download_tmp=$(mktemp "$repo_dir/.tools/cloudflared-download.XXXXXX")
  trap 'rm -f "$download_tmp"' EXIT HUP INT TERM
  curl -fSL --max-time 120 https://github.com/cloudflare/cloudflared/releases/download/2026.11.0/cloudflared-linux-amd64 -o "$download_tmp"
  printf '%s  %s\n' "$expected" "$download_tmp" | sha256sum -c -
  mv "$download_tmp" "$artifact"
fi
printf '%s  %s\n' "$expected" "$artifact" | sha256sum -c -
chmod 755 "$artifact"
"$artifact" --version
