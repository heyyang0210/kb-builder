#!/usr/bin/env bash
set -Eeuo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if (( $# == 0 )); then
  exec "$REPO_ROOT/knowledge-center.sh" restart
fi
exec "$REPO_ROOT/knowledge-center.sh" "$@"
