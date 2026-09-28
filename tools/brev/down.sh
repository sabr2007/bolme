#!/usr/bin/env bash
# LOCAL. Wipes models + HF token on the box, closes the tunnel and stops the instance.
#   tools/brev/down.sh [instance-name] [--delete]
# A stopped instance still bills its disk (~$0.46/day on Nebius); --delete removes it completely.
set -uo pipefail
NAME=${1:-motion-gen}
ssh -o BatchMode=yes "$NAME" 'bash ~/server_teardown.sh' || echo "teardown skipped (instance unreachable)"
pkill -f "8188:127.0.0.1:8188" 2>/dev/null || true
if [ "${2:-}" = "--delete" ]; then brev delete "$NAME"; else brev stop "$NAME"; fi
brev ls
