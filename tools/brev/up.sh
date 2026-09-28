#!/usr/bin/env bash
# LOCAL. Creates (or starts) a Brev H100, bootstraps ComfyUI + Wan 2.2 in RAM, opens the 8188 tunnel.
#   HF_TOKEN=hf_xxx tools/brev/up.sh [instance-name]      (HF_TOKEN optional but recommended)
# Needs: brev CLI logged in (`brev login`), ssh, scp.
set -euo pipefail
NAME=${1:-motion-gen}
# Nebius H100 80 GB, $4.62/h, can be stopped. Cheaper non-stoppable alternative: massedcompute_H100 ($3.28/h).
TYPE=${BREV_TYPE:-gpu-h100-sxm.1gpu-16vcpu-200gb}
HERE="$(cd "$(dirname "$0")" && pwd)"
SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new)

if brev ls 2>/dev/null | awk '{print $1}' | grep -qx "$NAME"; then
  brev start "$NAME" || true
else
  brev create "$NAME" --type "$TYPE" --detached
fi

echo "waiting for $NAME to be READY (first boot takes 10–20 min)…"
until brev ls 2>/dev/null | awk -v n="$NAME" '$1==n && $2=="RUNNING" && $4=="READY"' | grep -q .; do sleep 20; done
brev refresh >/dev/null 2>&1 || true   # (re)writes the ssh alias "$NAME"

scp -q -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$HERE/server_setup.sh" "$HERE/server_teardown.sh" "$NAME":~/
if [ -n "${HF_TOKEN:-}" ]; then printf '%s' "$HF_TOKEN" | "${SSH[@]}" "$NAME" 'umask 077; cat > ~/.hf_token'; fi
"${SSH[@]}" "$NAME" "tmux new-session -d -s setup 'bash ~/server_setup.sh'"
echo "setup running (5–15 min). Live log: ssh $NAME tail -f /dev/shm/setup.log"
until "${SSH[@]}" "$NAME" 'grep -qE "=== READY|did not start" /dev/shm/setup.log 2>/dev/null'; do sleep 20; done
"${SSH[@]}" "$NAME" 'grep -E "^(ok|FAIL|===)" /dev/shm/setup.log | tail -9'

pkill -f "8188:127.0.0.1:8188" 2>/dev/null || true
"${SSH[@]}" -o ExitOnForwardFailure=yes -f -N -L 8188:127.0.0.1:8188 "$NAME"
curl -s --max-time 10 http://127.0.0.1:8188/system_stats >/dev/null && echo "ComfyUI ready at http://127.0.0.1:8188 (instance: $NAME)"
