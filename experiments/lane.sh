#!/bin/bash
# DavesSweater experiments lane wrapper (Refactor 2 Lane 4). Sets the lane environment once and execs the shared
# lane helpers in shared-skills (reference, never a fork). PUBLIC REPO: nothing private in this file.
#   bash experiments/lane.sh state <run_state.py args...>   e.g. state start | state step preflight ok "..."
#   bash experiments/lane.sh digest                          builds the digest (experiments/scripts/digest.py)
#   bash experiments/lane.sh notify <run_id>                 fires the completion notify hook
cd "$(dirname "$0")/.." || exit 0
export LANE_REPO="${LANE_REPO:-$PWD}"
export LANE_ROOT="experiments"
export LANE_TITLE="DAVESSWEATER EXPERIMENTS"
export LANE_NAME="ds-experiments"
export LANE_NEXT="- Next fire: Wednesday 08:00 (routine ds-experiments-weekly); dead-man check Thursday 08:00."
HELPERS="$HOME/Projects/shared-skills/dev-env/lane"
case "$1" in
  state)  shift; exec python3 "$HELPERS/run_state.py" "$@" ;;
  digest) shift; exec python3 experiments/scripts/digest.py "$@" ;;
  notify) shift; printf '{"hook_event_name":"DigestReady","session_id":"%s","cwd":"%s"}' "${1:-experiments}" "$PWD" | bash "$HOME/Projects/shared-skills/dev-env/hooks/notify.sh"; echo "notified" ;;
  *) echo "usage: lane.sh state <args> | lane.sh digest | lane.sh notify <run_id>"; exit 0 ;;
esac
