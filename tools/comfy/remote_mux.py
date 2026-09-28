"""Runs ON the GPU server (ComfyUI venv): mux ComfyUI's numbered PNG frames into an H.264 mp4 with PyAV.

Usage: python remote_mux.py FRAMES_DIR PREFIX OUT.mp4 [FPS]
Also writes OUT.last.png (the final frame) so the next clip in a chain can start from it.
"""

from __future__ import annotations

import re
import shutil
import sys
from pathlib import Path

import av
from PIL import Image

FRAME_RE = re.compile(r"_(\d{5})_\.png$")


def frames_of(frames_dir: Path, prefix: str) -> list[Path]:
    files = [p for p in frames_dir.glob(f"{prefix}_*_.png") if FRAME_RE.search(p.name)]
    return sorted(files, key=lambda p: int(FRAME_RE.search(p.name).group(1)))


def mux(files: list[Path], out: Path, fps: int) -> None:
    first = Image.open(files[0])
    with av.open(str(out), mode="w") as container:
        stream = container.add_stream("libx264", rate=fps)
        stream.width, stream.height = first.size
        stream.pix_fmt = "yuv420p"
        stream.options = {"crf": "18", "preset": "medium", "movflags": "+faststart"}
        for path in files:
            frame = av.VideoFrame.from_image(Image.open(path).convert("RGB"))
            for packet in stream.encode(frame):
                container.mux(packet)
        for packet in stream.encode():
            container.mux(packet)


def main() -> int:
    frames_dir, prefix, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    fps = int(sys.argv[4]) if len(sys.argv) > 4 else 16
    files = frames_of(frames_dir, prefix)
    if not files:
        print(f"no frames for {prefix} in {frames_dir}", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    mux(files, out, fps)
    shutil.copy(files[-1], out.with_suffix(".last.png"))
    print(f"{out} frames={len(files)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
