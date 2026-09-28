#!/usr/bin/env bash
# Dev-only placeholder clips (dark frame + scene name) so the player works before real footage exists.
# Real clips from tools/comfy overwrite these files with the same names.
set -euo pipefail
OUT="$(dirname "$0")/../public/media"
mkdir -p "$OUT"
FONT="/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
[ -f "$FONT" ] || FONT="/System/Library/Fonts/Helvetica.ttc"
make() { # name color seconds
  local name=$1 color=$2 seconds=${3:-5}
  [ -f "$OUT/$name.mp4" ] && [ "${FORCE:-0}" != 1 ] && return
  ffmpeg -loglevel error -y -f lavfi -i "color=c=${color}:s=1280x720:d=${seconds}:r=16" \
    -vf "drawtext=fontfile='${FONT}':text='${name}':fontcolor=white@0.55:fontsize=56:x=(w-tw)/2:y=(h-th)/2,drawtext=fontfile='${FONT}':text='%{pts\\:hms}':fontcolor=white@0.35:fontsize=28:x=40:y=h-60" \
    -c:v libx264 -pix_fmt yuv420p -movflags +faststart "$OUT/$name.mp4"
  echo "placeholder $name.mp4"
}
make ticket-idle 0x1a2433
make wake 0x1f2a3a
make corridor 0x2a2320
make corridor-idle 0x2a2320
make vestibule 0x10202e
make dining 0x3a2a14
make stranger 0x2e2418
make stranger-idle 0x2e2418
make trust 0x3a2c18
make refuse 0x241c1c
make lights-out 0x0c0f14
make lights-out-idle 0x0c0f14
make call-out 0x1a1a24
make end-dream 0x4a4030
make end-conductor 0x1c2438
make end-forever 0x202020
make end-station 0x283038
