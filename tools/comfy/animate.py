"""Animate a keyframe with Wan 2.2 I2V (4-step) on the remote ComfyUI and mux the frames into an mp4 locally.

Usage: python3.12 tools/comfy/animate.py KEYFRAME.png "motion prompt" OUT.mp4 [--seed 7] [--frames 81] [--end END.png]
With --end the clip is generated between two frames (first-last-frame mode): seamless loops and hub transitions.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from comfy_client import ComfyClient
from graphs import WAN_FPS, wan_flf2v, wan_i2v


def mux(frames_dir: Path, stem: str, out: Path, fps: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(fps), "-i", str(frames_dir / f"{stem}_%d.png"),
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", str(out)],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("keyframe", type=Path)
    parser.add_argument("prompt")
    parser.add_argument("out", type=Path)
    parser.add_argument("--end", type=Path, default=None)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--frames", type=int, default=81)
    parser.add_argument("--host", default="http://127.0.0.1:8188")
    args = parser.parse_args()

    client = ComfyClient(args.host)
    started = time.monotonic()
    start_name = client.upload_image(args.keyframe)
    stem = args.out.stem
    if args.end:
        end_name = client.upload_image(args.end)
        graph = wan_flf2v(start_name, end_name, args.prompt, seed=args.seed, length=args.frames, prefix=f"clips/{stem}")
    else:
        graph = wan_i2v(start_name, args.prompt, seed=args.seed, length=args.frames, prefix=f"clips/{stem}")

    with tempfile.TemporaryDirectory() as tmp:
        frames, _ = client.run(graph, Path(tmp), stem)
        mux(Path(tmp), stem, args.out, WAN_FPS)
        # keep the last frame: the next clip in the chain starts from it
        shutil.copy(sorted(frames, key=lambda p: int(p.stem.rsplit("_", 1)[1]))[-1], args.out.with_suffix(".last.png"))
    print(f"{args.out} ({time.monotonic() - started:.0f}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
