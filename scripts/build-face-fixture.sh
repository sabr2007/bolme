#!/usr/bin/env bash
# Builds e2e/fixtures/face.y4m (Chrome fake-camera format) from the generated test-face clips:
# 5 s neutral still → smile → frown → head turned left (last 1.5 s of the turn clip, held 5 s).
# Inputs live in gen/testface (see tools/comfy).
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=gen/testface
OUT=e2e/fixtures/face.y4m
mkdir -p e2e/fixtures
ffmpeg -loglevel error -y \
  -loop 1 -t 5 -i "$SRC/webcam-face.png" -i "$SRC/tf-smile.mp4" -i "$SRC/tf-frown.mp4" -i "$SRC/tf-turn-left.mp4" \
  -filter_complex "[0]scale=640:360,fps=15,format=yuv420p,setsar=1[a];[1]scale=640:360,fps=15,format=yuv420p,setsar=1[b];[2]scale=640:360,fps=15,format=yuv420p,setsar=1[c];[3]trim=start=3.5,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=5,scale=640:360,fps=15,format=yuv420p,setsar=1[d];[a][b][c][d]concat=n=4:v=1:a=0[v]" \
  -map "[v]" -pix_fmt yuv420p "$OUT"
ls -la "$OUT"
