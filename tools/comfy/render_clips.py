"""Batch-render story clips with Wan 2.2 on the remote ComfyUI, keeping the GPU busy.

All jobs are queued at once (ComfyUI runs them one by one); every finished clip is muxed to mp4 on the
server (tools/comfy/remote_mux.py) and copied back over SSH while the GPU works on the next one.

Usage: python3.12 tools/comfy/render_clips.py clips.json OUT_DIR [--ssh-host motion-gen] [--only name,name]
clips.json: [{"name": "wake", "start": "gen/keyframes/kf.png", "end": null, "prompt": "...", "seed": 7, "frames": 81}]
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

REMOTE_OUT = "/dev/shm/comfy-out/clips"
REMOTE_CLIPS = "/dev/shm/clips"
REMOTE_MUX = "/dev/shm/remote_mux.py"
REMOTE_PY = "~/ComfyUI/.venv/bin/python"
LAST_FRAMES = Path(__file__).resolve().parents[2] / "gen" / "lastframes"


def queue_job(client: ComfyClient, job: dict, uploaded: dict[str, str]) -> tuple[str, str]:
    def upload(path: str) -> str:
        if path not in uploaded:
            uploaded[path] = client.upload_image(Path(path))
        return uploaded[path]

    prefix = f"{job['name']}_{uuid.uuid4().hex[:6]}"
    common = {"seed": job.get("seed", 7), "length": job.get("frames", 81), "prefix": f"clips/{prefix}"}
    if job.get("end"):
        graph = wan_flf2v(upload(job["start"]), upload(job["end"]), job["prompt"], **common)
    else:
        graph = wan_i2v(upload(job["start"]), job["prompt"], **common)
    return client.queue(graph), prefix


def fetch_clip(ssh_host: str, name: str, prefix: str, out_dir: Path) -> None:
    remote_mp4 = f"{REMOTE_CLIPS}/{name}.mp4"
    subprocess.run(
        ["ssh", "-o", "BatchMode=yes", ssh_host,
         f"{REMOTE_PY} {REMOTE_MUX} {REMOTE_OUT} {prefix} {remote_mp4} {WAN_FPS}"],
        check=True, capture_output=True, text=True,
    )
    subprocess.run(["scp", "-q", "-o", "BatchMode=yes", f"{ssh_host}:{remote_mp4}", str(out_dir)], check=True)
    # the last frame is a working file (start of a chained clip), so it stays out of the published folder
    LAST_FRAMES.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["scp", "-q", "-o", "BatchMode=yes", f"{ssh_host}:{REMOTE_CLIPS}/{name}.last.png", str(LAST_FRAMES)], check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("jobs", type=Path)
    parser.add_argument("out_dir", type=Path)
    parser.add_argument("--ssh-host", default="motion-gen")
    parser.add_argument("--host", default="http://127.0.0.1:8188")
    parser.add_argument("--only", default="")
    args = parser.parse_args()

    jobs = json.loads(args.jobs.read_text())
    if args.only:
        wanted = set(args.only.split(","))
        jobs = [j for j in jobs if j["name"] in wanted]
    args.out_dir.mkdir(parents=True, exist_ok=True)

    client = ComfyClient(args.host)
    uploaded: dict[str, str] = {}
    pending = {}
    for job in jobs:
        prompt_id, prefix = queue_job(client, job, uploaded)
        pending[prompt_id] = (job["name"], prefix, time.monotonic())
        print(f"queued {job['name']}", flush=True)

    failed = []
    with ThreadPoolExecutor(max_workers=3) as transfers:
        futures = []
        for prompt_id, (name, prefix, _) in pending.items():
            try:
                client.wait(prompt_id, timeout_s=3600)
            except ComfyError as err:
                print(f"FAIL {name}: {err}", flush=True)
                failed.append(name)
                continue
            print(f"rendered {name}", flush=True)
            futures.append((name, transfers.submit(fetch_clip, args.ssh_host, name, prefix, args.out_dir)))
        for name, future in futures:
            try:
                future.result()
                print(f"saved {args.out_dir / (name + '.mp4')}", flush=True)
            except subprocess.CalledProcessError as err:
                print(f"FAIL transfer {name}: {err.stderr or err}", flush=True)
                failed.append(name)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
