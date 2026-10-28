#!/usr/bin/env bash
set -euo pipefail
plugin_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd -- "$plugin_dir/../../.." && pwd)"
entry="$repo_dir/runtime/rea/tooling/node_modules/rea-agents/scripts/rea.mjs"
if [[ ! -f "$entry" ]]; then
  printf '%s\n' 'REA 尚未安装，请先运行本插件 scripts/install.sh。' >&2
  exit 1
fi
exec node "$entry" "$@"
