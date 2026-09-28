"""Batch-render story clips with Wan 2.2 on the remote ComfyUI, keeping the GPU busy.

All jobs are queued at once (ComfyUI runs them one by one). Each finished clip is muxed to mp4 ON the
server (remote_mux.py, uploaded automatically), copied back as a master to gen/masters/, and
re-encoded for the web into public/media/ (unless --no-publish).

Usage:
  python3.12 tools/comfy/render_clips.py content/clips.json --only wake,trust
  python3.12 tools/comfy/render_clips.py content/testface-clips.json --publish-dir e2e/assets

clips.json: [{"name": "wake", "start": "content/keyframes/kf.jpg", "end": null, "prompt": "...", "seed": 7, "frames": 81}]
"end" set = first-last-frame mode (seamless loops and hub transitions).
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from comfy_client import ComfyClient, ComfyError
from graphs import WAN_FPS, wan_flf2v, wan_i2v

ROOT = Path(__file__).resolve().parents[2]
REMOTE_OUT = "/dev/shm/comfy-out/clips"
REMOTE_CLIPS = "/dev/shm/clips"
REMOTE_MUX = "/dev/shm/remote_mux.py"
REMOTE_PY = "~/ComfyUI/.venv/bin/python"
LOCAL_MUX = Path(__file__).with_name("remote_mux.py")
LAST_FRAMES = ROOT / "gen" / "lastframes"
WEB_CRF = "25"


def ssh(host: str, command: str) -> None:
    subprocess.run(["ssh", "-o", "BatchMode=yes", host, command], check=True, capture_output=True, text=True)


def scp(*args: str) -> None:
    subprocess.run(["scp", "-q", "-o", "BatchMode=yes", *args], check=True)


def queue_job(client: ComfyClient, job: dict, uploaded: dict[str, str]) -> tuple[str, str]:
    def upload(path: str) -> str:
        if path not in uploaded:
            uploaded[path] = client.upload_image(ROOT / path)
        return uploaded[path]

    prefix = f"{job['name']}_{uuid.uuid4().hex[:6]}"
    common = {"seed": job.get("seed", 7), "length": job.get("frames", 81), "prefix": f"clips/{prefix}"}
    if job.get("end"):
        graph = wan_flf2v(upload(job["start"]), upload(job["end"]), job["prompt"], **common)
    else:
        graph = wan_i2v(upload(job["start"]), job["prompt"], **common)
    return client.queue(graph), prefix


def encode_web(master: Path, publish_dir: Path) -> Path:
    publish_dir.mkdir(parents=True, exist_ok=True)
    target = publish_dir / master.name
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(master), "-c:v", "libx264", "-preset", "slow", "-crf", WEB_CRF,
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", str(target)],
        check=True,
    )
    return target


def fetch_clip(host: str, name: str, prefix: str, masters: Path, publish_dir: Path | None) -> str:
    remote_mp4 = f"{REMOTE_CLIPS}/{name}.mp4"
    ssh(host, f"{REMOTE_PY} {REMOTE_MUX} {REMOTE_OUT} {prefix} {remote_mp4} {WAN_FPS}")
    masters.mkdir(parents=True, exist_ok=True)
    LAST_FRAMES.mkdir(parents=True, exist_ok=True)
    scp(f"{host}:{remote_mp4}", str(masters))
    # the last frame is a working file (start of a chained clip), not part of the published site
    scp(f"{host}:{REMOTE_CLIPS}/{name}.last.png", str(LAST_FRAMES))
    master = masters / f"{name}.mp4"
    return str(encode_web(master, publish_dir)) if publish_dir else str(master)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("jobs", type=Path)
    parser.add_argument("--only", default="", help="comma-separated clip names")
    parser.add_argument("--ssh-host", default="motion-gen", help="Brev instance name (ssh alias)")
    parser.add_argument("--host", default="http://127.0.0.1:8188", help="ComfyUI via `ssh -L 8188:127.0.0.1:8188`")
    parser.add_argument("--masters", type=Path, default=ROOT / "gen" / "masters")
    parser.add_argument("--publish-dir", type=Path, default=ROOT / "public" / "media")
    parser.add_argument("--no-publish", action="store_true", help="keep only the masters")
    args = parser.parse_args()

    jobs = json.loads(args.jobs.read_text())
    if args.only:
        wanted = set(args.only.split(","))
        unknown = wanted - {j["name"] for j in jobs}
        if unknown:
            print(f"unknown clip names: {sorted(unknown)}", file=sys.stderr)
            return 2
        jobs = [j for j in jobs if j["name"] in wanted]

    scp(str(LOCAL_MUX), f"{args.ssh_host}:{REMOTE_MUX}")
    client = ComfyClient(args.host)
    uploaded: dict[str, str] = {}
    pending = {}
    for job in jobs:
        prompt_id, prefix = queue_job(client, job, uploaded)
        pending[prompt_id] = (job["name"], prefix, time.monotonic())
        print(f"queued {job['name']}", flush=True)

    publish_dir = None if args.no_publish else args.publish_dir
    failed = []
    with ThreadPoolExecutor(max_workers=3) as transfers:
        futures = []
        for prompt_id, (name, prefix, started) in pending.items():
            try:
                client.wait(prompt_id, timeout_s=3600)
            except ComfyError as err:
                print(f"FAIL {name}: {err}", flush=True)
                failed.append(name)
                continue
            print(f"rendered {name} ({time.monotonic() - started:.0f}s since queued)", flush=True)
            futures.append((name, transfers.submit(fetch_clip, args.ssh_host, name, prefix, args.masters, publish_dir)))
        for name, future in futures:
            try:
                print(f"saved {future.result()}", flush=True)
            except subprocess.CalledProcessError as err:
                print(f"FAIL transfer {name}: {err.stderr or err}", flush=True)
                failed.append(name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
