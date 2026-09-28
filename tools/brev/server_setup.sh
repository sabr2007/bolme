#!/usr/bin/env bash
# Runs ON the Brev GPU box. Bootstraps ComfyUI + Wan 2.2 (I2V 14B fp8, 4-step lightx2v LoRA).
#
# Models live in RAM (/dev/shm): the instance's network disk throttles to ~60 MB/s after ~100 GB of
# writes and every download then hangs. RAM is wiped by `brev stop`, so this script is re-run after
# every start (the ComfyUI install on disk is reused, only models are re-downloaded: ~1–2 min).
#
# Started detached by tools/brev/up.sh:  tmux new-session -d -s setup 'bash ~/server_setup.sh'
# Progress: /dev/shm/setup.log. Optional ~/.hf_token (read-only HF token) avoids anonymous rate limits.
set -uo pipefail
LOG=/dev/shm/setup.log
exec >> "$LOG" 2>&1
echo "=== setup $(date)"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

# 1. aria2 for fast parallel downloads; skip the man-db trigger that can hang apt for minutes
sudo rm -f /var/lib/man-db/auto-update
command -v aria2c >/dev/null || { sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq aria2; }

# 2. ComfyUI in a uv venv (kept on disk between stop/start)
export PATH="$HOME/.local/bin:$PATH"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
cd "$HOME"
[ -d ComfyUI ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
[ -d .venv ] || uv venv --python 3.12 .venv
source .venv/bin/activate
uv pip install -q torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
uv pip install -q -r requirements.txt
# huggingface_hub 2.x breaks the transformers version ComfyUI pins ("huggingface-hub>=1.5.0,<2.0 is required")
uv pip install -q "huggingface_hub>=1.5,<2"
python -c "import torch; assert torch.cuda.is_available(); print('torch', torch.__version__, 'cuda ok')"

# 3. models → RAM, symlinked into ComfyUI's model folders
D=/dev/shm/models
M="$HOME/ComfyUI/models"
mkdir -p "$D"
AUTH=()
[ -s "$HOME/.hf_token" ] && AUTH=(--header="Authorization: Bearer $(cat "$HOME/.hf_token")")
fetch() { # repo file dest-folder
  local repo=$1 file=$2 dest=$3 name
  name=$(basename "$file")
  aria2c -q -c -x8 -s8 -k16M --file-allocation=none --auto-file-renaming=false "${AUTH[@]}" \
    --lowest-speed-limit=2M --timeout=20 --max-tries=0 --retry-wait=2 \
    -d "$D" -o "$name" "https://huggingface.co/$repo/resolve/main/$file" \
    && mkdir -p "$M/$dest" && ln -sfn "$D/$name" "$M/$dest/$name" && echo "ok $name" || echo "FAIL $name"
}
W=Comfy-Org/Wan_2.2_ComfyUI_Repackaged
fetch $W split_files/diffusion_models/wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors diffusion_models &
fetch $W split_files/diffusion_models/wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors diffusion_models &
fetch $W split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors loras &
fetch $W split_files/loras/wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors loras &
fetch $W split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors text_encoders &
fetch $W split_files/vae/wan_2.1_vae.safetensors vae &
wait
du -shL "$D"

# 4. ComfyUI in tmux (survives SSH disconnects; `brev exec ... &` does not). Outputs stay in RAM too.
mkdir -p /dev/shm/comfy-out /dev/shm/clips
tmux kill-session -t comfy 2>/dev/null
tmux new-session -d -s comfy "cd $HOME/ComfyUI && source .venv/bin/activate && python main.py --listen 127.0.0.1 --port 8188 --output-directory /dev/shm/comfy-out 2>&1 | tee /dev/shm/comfy.log"
for _ in $(seq 1 120); do curl -s localhost:8188/system_stats >/dev/null && break; sleep 2; done
if curl -s localhost:8188/system_stats >/dev/null; then echo "=== READY $(date)"; else echo "=== ComfyUI did not start, see /dev/shm/comfy.log"; fi
