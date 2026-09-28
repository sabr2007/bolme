"""Minimal ComfyUI HTTP client (stdlib only): upload, queue a graph, wait, download outputs."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

DEFAULT_HOST = "http://127.0.0.1:8188"
POLL_INTERVAL_S = 2.0
OUTPUT_KINDS = ("images", "gifs", "videos")


class ComfyError(RuntimeError):
    pass


class ComfyClient:
    def __init__(self, host: str = DEFAULT_HOST):
        self.host = host.rstrip("/")
        self.client_id = str(uuid.uuid4())

    def _request(self, path: str, payload: dict | None = None) -> dict:
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(
            self.host + path,
            data=data,
            headers={"Content-Type": "application/json"} if data else {},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as err:
            raise ComfyError(f"{path} -> HTTP {err.code}: {err.read().decode()[:2000]}") from err

    def upload_image(self, path: Path, name: str | None = None) -> str:
        """Uploads a local image to ComfyUI's input folder; returns the name to use in LoadImage."""
        boundary = uuid.uuid4().hex
        filename = name or path.name
        body = b"".join([
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n".encode(),
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{filename}\"\r\n"
            f"Content-Type: image/png\r\n\r\n".encode(),
            path.read_bytes(),
            f"\r\n--{boundary}--\r\n".encode(),
        ])
        req = urllib.request.Request(
            self.host + "/upload/image", data=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.load(resp)
        except urllib.error.HTTPError as err:
            raise ComfyError(f"upload -> HTTP {err.code}: {err.read().decode()[:500]}") from err
        return f"{result['subfolder']}/{result['name']}" if result.get("subfolder") else result["name"]

    def object_info(self, node_class: str | None = None) -> dict:
        return self._request(f"/object_info/{node_class}" if node_class else "/object_info")

    def queue(self, graph: dict) -> str:
        result = self._request("/prompt", {"prompt": graph, "client_id": self.client_id})
        if result.get("node_errors"):
            raise ComfyError(f"node errors: {json.dumps(result['node_errors'])[:2000]}")
        return result["prompt_id"]

    def wait(self, prompt_id: str, timeout_s: float = 1800) -> dict:
        deadline = time.monotonic() + timeout_s
        while time.monotonic() < deadline:
            history = self._request(f"/history/{prompt_id}")
            entry = history.get(prompt_id)
            if entry:
                status = entry.get("status", {})
                if status.get("status_str") == "error":
                    raise ComfyError(f"execution failed: {json.dumps(status.get('messages'))[:2000]}")
                if status.get("completed", True):
                    return entry["outputs"]
            time.sleep(POLL_INTERVAL_S)
        raise ComfyError(f"timeout waiting for {prompt_id}")

    def download(self, outputs: dict, dest_dir: Path, stem: str) -> list[Path]:
        dest_dir.mkdir(parents=True, exist_ok=True)
        files = [f for node in outputs.values() for kind in OUTPUT_KINDS for f in node.get(kind, [])]
        saved = []
        for index, meta in enumerate(files):
            query = urllib.parse.urlencode(
                {"filename": meta["filename"], "subfolder": meta.get("subfolder", ""), "type": meta.get("type", "output")}
            )
            suffix = Path(meta["filename"]).suffix
            name = f"{stem}{suffix}" if len(files) == 1 else f"{stem}_{index}{suffix}"
            target = dest_dir / name
            with urllib.request.urlopen(f"{self.host}/view?{query}", timeout=120) as resp:
                target.write_bytes(resp.read())
            saved.append(target)
        return saved

    def run(self, graph: dict, dest_dir: Path, stem: str) -> tuple[list[Path], list[dict]]:
        """Queue, wait, download. Returns local paths and the raw server-side file metadata."""
        outputs = self.wait(self.queue(graph))
        server_files = [f for node in outputs.values() for kind in OUTPUT_KINDS for f in node.get(kind, [])]
        return self.download(outputs, dest_dir, stem), server_files
