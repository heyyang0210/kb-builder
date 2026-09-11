#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/load-yashandb-env.sh"
EXP_FILE="${1:-}"
IMP_BIN="${YASDB_IMP_BIN:-}"

if [[ -z "$EXP_FILE" ]]; then
  read -r -p "请输入 YashanDB 导出文件路径: " EXP_FILE
fi
if [[ -z "$EXP_FILE" || ! -f "$EXP_FILE" ]]; then
  echo "导出文件不存在：${EXP_FILE:-未提供}" >&2
  exit 1
fi

if [[ -z "$IMP_BIN" ]]; then
  IMP_BIN="$(command -v imp || true)"
fi
if [[ -z "$IMP_BIN" && -x "/home/hey/.yasboot/yashandb_yasdb_home/bin/imp" ]]; then
  IMP_BIN="/home/hey/.yasboot/yashandb_yasdb_home/bin/imp"
fi
if [[ -z "$IMP_BIN" || ! -x "$IMP_BIN" ]]; then
  echo "未找到 YashanDB imp，请设置 YASDB_IMP_BIN。" >&2
  exit 1
fi

require_value() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    read -r -p "请输入 ${name}: " value
    export "$name=$value"
  fi
  if [[ -z "$value" ]]; then
    echo "${name} 不能为空。" >&2
    exit 1
  fi
}

require_value YASDB_IMP_USER
require_value YASDB_IMP_SERVER_HOST
require_value YASDB_IMP_FROMUSER
YASDB_IMP_TOUSER="${YASDB_IMP_TOUSER:-$YASDB_IMP_FROMUSER}"

if [[ -z "${YASDB_IMP_PASSWORD:-}" ]]; then
  read -r -s -p "请输入 YASDB_IMP_PASSWORD（不会回显）: " YASDB_IMP_PASSWORD
  echo
fi
if [[ -z "$YASDB_IMP_PASSWORD" ]]; then
  echo "YASDB_IMP_PASSWORD 不能为空。" >&2
  exit 1
fi

LOG_DIR="${YASDB_IMP_LOG_DIR:-$(dirname "$EXP_FILE")}"
mkdir -p "$LOG_DIR"

echo "即将执行 YashanDB OWNER 导入："
echo "  数据库：$YASDB_IMP_SERVER_HOST"
echo "  源用户：$YASDB_IMP_FROMUSER"
echo "  目标用户：$YASDB_IMP_TOUSER"
echo "  导入文件：$EXP_FILE"
echo "  策略：保留目标表已有数据，不启用 TRUNCATE"
read -r -p "确认开始导入？[y/N] " confirmation
if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
  echo "已取消导入。"
  exit 0
fi

"$IMP_BIN" "$YASDB_IMP_USER/$YASDB_IMP_PASSWORD@$YASDB_IMP_SERVER_HOST" \
  "FILE=$EXP_FILE" \
  "FROMUSER=$YASDB_IMP_FROMUSER" \
  "TOUSER=$YASDB_IMP_TOUSER" \
  "ROWS=${YASDB_IMP_ROWS:-Y}" \
  "LOG_PATH=$LOG_DIR" \
  "LOG_LEVEL=${YASDB_IMP_LOG_LEVEL:-INFO}"

echo "导入完成：$EXP_FILE"
