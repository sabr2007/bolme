"""Generate keyframes with the Codex CLI built-in image generation tool, several in parallel.

Usage: python3.12 tools/imagegen/codex_images.py content/keyframes.json content/keyframes --jpg --only kf-dining
jobs.json: [{"name": "kf-dining", "prompt": "...", "refs": ["content/keyframes/kf-hub1-corridor.jpg"]}]
Requires the Codex CLI logged in with image generation enabled (`codex features list | grep image_generation`).
--jpg: store a 1280px JPG (what the repo keeps) instead of the ~2 MB PNG.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

TIMEOUT_S = 600

INSTRUCTION = (
    "Use your image generation tool to create ONE image, landscape 16:9 (the widest landscape size available). "
    "Save the final PNG in the current working directory as {name}.png and reply only with the saved file path. "
    "Do not add any text, captions, logos or watermarks to the image.{refs_note}\n\n{prompt}"
)
REFS_NOTE = (
    " The attached image(s) are REFERENCES: keep the same characters, faces, costumes, materials and visual style, "
    "but compose the new scene described below."
)


def generate(job: dict, out_dir: Path) -> tuple[str, bool, float]:
    started = time.monotonic()
    refs = [str(Path(r).resolve()) for r in job.get("refs", [])]
    prompt = INSTRUCTION.format(name=job["name"], prompt=job["prompt"], refs_note=REFS_NOTE if refs else "")
    cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "workspace-write", "-C", str(out_dir)]
    for ref in refs:
        cmd += ["-i", ref]
    # `-i` takes several files, so "--" is required or the prompt is swallowed as another image path
    cmd += ["--", prompt]
    try:
        # stdin must be closed: with an open pipe codex waits for extra prompt text forever
        subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=TIMEOUT_S, check=False)
    except subprocess.TimeoutExpired:
        return job["name"], False, time.monotonic() - started
    ok = (out_dir / f"{job['name']}.png").exists()
    return job["name"], ok, time.monotonic() - started


def to_jpg(png: Path) -> Path:
    jpg = png.with_suffix(".jpg")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(png), "-vf", "scale=1280:-2", "-q:v", "3", str(jpg)],
                   check=True)
    png.unlink()
    return jpg


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("jobs", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--parallel", type=int, default=4)
    parser.add_argument("--only", default="", help="comma-separated names")
    parser.add_argument("--jpg", action="store_true", help="convert results to 1280px JPG")
    parser.add_argument("--force", action="store_true", help="regenerate images that already exist")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    jobs = json.loads(args.jobs.read_text())
    if args.only:
        wanted = set(args.only.split(","))
        jobs = [j for j in jobs if j["name"] in wanted]
    ext = "jpg" if args.jpg else "png"
    todo = [j for j in jobs if args.force or not (args.out_dir / f"{j['name']}.{ext}").exists()]
    print(f"{len(todo)} to generate, {len(jobs) - len(todo)} already exist", flush=True)

    failed = []
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        futures = [pool.submit(generate, job, args.out_dir.resolve()) for job in todo]
        for future in as_completed(futures):
            name, ok, seconds = future.result()
            if ok and args.jpg:
                to_jpg(args.out_dir / f"{name}.png")
            print(f"{'ok  ' if ok else 'FAIL'} {name} ({seconds:.0f}s)", flush=True)
            if not ok:
                failed.append(name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
