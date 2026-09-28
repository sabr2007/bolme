#!/usr/bin/env bash
# Re-encodes rendered clips for the web (CRF 25, faststart, no audio) into public/media.
# Masters from tools/comfy/render_clips.py are kept in gen/masters (not committed).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p gen/masters
for clip in "$@"; do
  name=$(basename "$clip")
  [ "$clip" -ef "gen/masters/$name" ] || cp "$clip" "gen/masters/$name"
  ffmpeg -loglevel error -y -i "gen/masters/$name" -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p \
    -movflags +faststart -an "public/media/$name"
  echo "web: public/media/$name ($(du -h "public/media/$name" | cut -f1))"
done
