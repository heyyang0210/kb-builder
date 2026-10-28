#!/usr/bin/env bash
set -euo pipefail
plugin_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd -- "$plugin_dir/../../.." && pwd)"
install_dir="$repo_dir/runtime/rea/tooling"
mkdir -p -- "$install_dir"
cp -- "$plugin_dir/tooling/package.json" "$plugin_dir/tooling/package-lock.json" "$install_dir/"
npm ci --prefix "$install_dir" --ignore-scripts --omit=optional --no-audit --no-fund --engine-strict
printf '%s\n' 'REA 安装完成；原生引擎与 MCP 连接需按目标分别配置。'
