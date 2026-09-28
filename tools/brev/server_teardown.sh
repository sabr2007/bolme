#!/usr/bin/env bash
# Runs ON the Brev GPU box before stopping it: removes every model, output and the HF token.
# The [x]yz patterns keep pkill from matching this very command line.
pkill -f "[m]ain.py --listen"
pkill -f "[a]ria2c"
tmux kill-server 2>/dev/null
rm -rf /dev/shm/models /dev/shm/comfy-out /dev/shm/clips /dev/shm/remote_mux.py /dev/shm/*.log \
  "$HOME/.hf_token" "$HOME/.cache/huggingface"
find "$HOME/ComfyUI/models" -type l -delete 2>/dev/null
find "$HOME/ComfyUI/models" -name '*.safetensors' -delete 2>/dev/null
echo "models left: $(find "$HOME/ComfyUI/models" -name '*.safetensors' 2>/dev/null | wc -l | tr -d ' '), token: $(test -f "$HOME/.hf_token" && echo PRESENT || echo removed)"
