"""Style test: the same 3 scenes of "Night Train" rendered in two candidate styles, plus one motion clip per style.

Usage: python tools/comfy/style_test.py [--host http://127.0.0.1:8188] [--no-video]
"""

import argparse
import sys
import time
from pathlib import Path

from comfy_client import ComfyClient
from graphs import qwen_t2i, wan_i2v

OUT_DIR = Path(__file__).resolve().parents[2] / "gen" / "style-tests"
SEEDS = (11, 42)

STYLES = {
    "A-stopmotion": (
        "Stop-motion animation film still. Handcrafted miniature set and clay puppets with visible fingerprints, "
        "felt and wool costumes, glass bead eyes, slightly uneven handmade surfaces and tiny props. Practical "
        "miniature lighting, shallow depth of field, 35mm cinematic lens, light atmospheric haze. Eerie but "
        "whimsical dark fairy tale mood, muted teal shadows and warm amber lamp light."
    ),
    "B-noir-graphic": (
        "Graphic novel illustration in cinematic film noir style. Heavy black ink shadows, bold expressive brush "
        "strokes, cross-hatching, subtle paper grain texture. Limited palette: deep black, sodium-vapor orange lamp "
        "light and cold moonlight blue. Dramatic chiaroscuro lighting, wide cinematic composition, painterly and moody."
    ),
}

SCENES = {
    "1-conductor": (
        "First-person point of view from inside a small sleeper compartment of an old night train. A mysterious "
        "female train conductor in her forties leans in the doorway and looks directly into the camera with a calm, "
        "unsettling half-smile. She wears a dark navy railway uniform with brass buttons and a small cap, and holds "
        "an old brass oil lantern that casts warm light on her pale face. Behind her a dim corridor with curtains. "
        "Through the window: a dark endless steppe under a full moon."
    ),
    "2-corridor-fork": (
        "First-person point of view standing in the narrow corridor of an old sleeper train carriage at night. At the "
        "end of the corridor there are two doors side by side: the left door is dark, with frosted glass and a faint "
        "shadowy silhouette behind it; the right door is ajar, spilling warm golden light and steam from the dining "
        "car. Worn red carpet runner, row of compartment doors, lace curtains, moonlit empty steppe outside the windows."
    ),
    "3-stranger-tea": (
        "First-person point of view sitting at a small table in a sleeper compartment of an old night train. Across "
        "the table sits an old man with a grey beard and a worn wool coat, holding out a glass of hot tea in an ornate "
        "metal tea-glass holder toward the camera, steam rising. His eyes glint strangely in the lamp light, and his "
        "shadow on the wall behind him does not match his pose. The window beside him shows the dark steppe and a lonely moon."
    ),
}

MOTION_SCENE = "1-conductor"
MOTION_PROMPT = (
    "The train conductor slowly raises the brass lantern and tilts her head, her eyes stay fixed on the camera. "
    "The lantern flame flickers, the carriage sways gently, moonlight slides across her face. Static camera."
)


def render_keyframes(client: ComfyClient) -> dict[str, str]:
    """Returns {style: server-side annotated name of the first seed's motion-scene keyframe}."""
    motion_sources = {}
    for style, style_text in STYLES.items():
        for scene, scene_text in SCENES.items():
            for seed in SEEDS:
                stem = f"{style}__{scene}__s{seed}"
                started = time.monotonic()
                graph = qwen_t2i(f"{scene_text}\n\n{style_text}", seed=seed, prefix=f"style/{stem}")
                paths, server_files = client.run(graph, OUT_DIR, stem)
                print(f"{stem}: {paths[0].name} ({time.monotonic() - started:.0f}s)", flush=True)
                if scene == MOTION_SCENE and seed == SEEDS[0]:
                    meta = server_files[0]
                    subfolder = f"{meta['subfolder']}/" if meta.get("subfolder") else ""
                    motion_sources[style] = f"{subfolder}{meta['filename']} [output]"
    return motion_sources


def render_motion(client: ComfyClient, motion_sources: dict[str, str]) -> None:
    for style, image in motion_sources.items():
        stem = f"{style}__{MOTION_SCENE}__motion"
        started = time.monotonic()
        paths, _ = client.run(wan_i2v(image, MOTION_PROMPT, seed=SEEDS[0], prefix=f"style/{stem}"), OUT_DIR, stem)
        print(f"{stem}: {paths[0].name} ({time.monotonic() - started:.0f}s)", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="http://127.0.0.1:8188")
    parser.add_argument("--no-video", action="store_true")
    args = parser.parse_args()

    client = ComfyClient(args.host)
    motion_sources = render_keyframes(client)
    if not args.no_video:
        render_motion(client, motion_sources)
    print(f"done -> {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
