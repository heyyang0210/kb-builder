#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODE=""; ROLLBACK_VERSION=""
DEPLOY_HOST="\${KNOWLEDGE_CENTER_DEPLOY_HOST:-172.16.91.10}"
DEPLOY_USER="\${KNOWLEDGE_CENTER_DEPLOY_USER:-hey}"
DEPLOY_PORT="\${KNOWLEDGE_CENTER_DEPLOY_PORT:-22}"
DEPLOY_ROOT="\${KNOWLEDGE_CENTER_DEPLOY_ROOT:-/data/code/kb-builder}"
IDENTITY_FILE="\${KNOWLEDGE_CENTER_DEPLOY_IDENTITY_FILE:-$HOME/.ssh/id_ed25519}"
VERSION="\${KNOWLEDGE_CENTER_DEPLOY_VERSION:-$(date '+%Y%m%d-%H%M%S')}"

usage() {
  cat <<'EOF'
用法：
  sync-production.sh --check [连接参数]
  sync-production.sh --apply [--version YYYYmmdd-HHMMSS] [连接参数]
  sync-production.sh --rollback VERSION [连接参数]
参数：--host HOST --user USER --port PORT --remote-dir DIR --identity-file FILE
--check 不连接生产机；--apply 显式同步、构建、切换、重启；--rollback 切换已有版本。
EOF
}

while (( $# > 0 )); do
  case "$1" in
    --check|--apply) [[ -z "$MODE" ]] || exit 2; MODE="\${1#--}"; shift ;;
    --rollback) [[ -z "$MODE" && -n "\${2:-}" ]] || exit 2; MODE=rollback; ROLLBACK_VERSION="$2"; shift 2 ;;
    --host) DEPLOY_HOST="$2"; shift 2 ;; --user) DEPLOY_USER="$2"; shift 2 ;;
    --port) DEPLOY_PORT="$2"; shift 2 ;; --remote-dir) DEPLOY_ROOT="$2"; shift 2 ;;
    --identity-file) IDENTITY_FILE="$2"; shift 2 ;; --version) VERSION="$2"; shift 2 ;;
    -h|--help|help) usage; exit 0 ;; *) echo "错误：未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done
[[ -n "$MODE" ]] || { usage >&2; exit 2; }
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ ]] && (( DEPLOY_PORT > 0 && DEPLOY_PORT < 65536 )) || { echo '错误：SSH 端口无效' >&2; exit 2; }
[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || { echo '错误：版本格式无效' >&2; exit 2; }
case "$DEPLOY_ROOT" in /*) ;; *) echo '错误：远端目录必须是绝对路径' >&2; exit 2 ;; esac

for tool in ssh rsync; do command -v "$tool" >/dev/null || { echo "错误：缺少 $tool" >&2; exit 1; }; done
[[ -r "$IDENTITY_FILE" ]] || { echo "错误：私钥不可读：$IDENTITY_FILE" >&2; exit 1; }
[[ "$(stat -c '%a' "$IDENTITY_FILE")" =~ ^(400|600)$ ]] || { echo '错误：私钥权限必须为 400 或 600' >&2; exit 1; }

plan() {
  printf '%s\n' "生产目标：$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PORT" "部署目录：$DEPLOY_ROOT" "版本：$VERSION" \
    '排除：.git、external、runtime、node_modules、环境文件、密钥、日志' \
    '流程：预检、同步、构建、停止旧版、原子切换、启动、健康检查；失败自动回退'
}
if [[ "$MODE" == check ]]; then plan; echo '检查完成：未连接、未修改生产机。'; exit 0; fi

SSH_ARGS=(-p "$DEPLOY_PORT" -i "$IDENTITY_FILE" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new)
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
RSYNC_SSH="ssh -p $DEPLOY_PORT -i $IDENTITY_FILE -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

ssh "\${SSH_ARGS[@]}" "$TARGET" bash -s -- "$DEPLOY_ROOT" <<'REMOTE'
set -Eeuo pipefail
base=$1
for tool in bash rsync git node npm java python3 curl sha256sum flock; do command -v "$tool" >/dev/null || { echo "错误：生产机缺少 $tool" >&2; exit 1; }; done
mkdir -p "$base"
[[ -w "$base" ]] || { echo "错误：目录不可写：$base" >&2; exit 1; }
available=$(df -Pk "$base" | awk 'NR==2 {print $4}')
(( available >= 2097152 )) || { echo '错误：可用空间不足 2 GiB' >&2; exit 1; }
echo "生产预检通过：$((available / 1024)) MiB 可用"
REMOTE

release() {
  local action=$1 selected=$2
  ssh "\${SSH_ARGS[@]}" "$TARGET" bash -s -- "$DEPLOY_ROOT" "$selected" "$action" <<'REMOTE'
set -Eeuo pipefail
base=$1; version=$2; action=$3
candidate="$base/releases/$version"; shared="$base/shared"
mkdir -p "$shared/deployment/logs"
log="$shared/deployment/logs/$action-$version-$(date '+%Y%m%d-%H%M%S').log"
exec > >(tee -a "$log") 2>&1
active=""; [[ ! -L "$base/current" ]] || active=$(readlink -f "$base/current")
switch_current() { tmp="$base/.current.$$"; ln -s "$1" "$tmp"; mv -Tf "$tmp" "$base/current"; }
restore() {
  code=$?; trap - ERR; echo "发布失败，恢复：\${active:-无}" >&2
  if [[ -n "$active" && -x "$active/knowledge-center.sh" ]]; then switch_current "$active"; "$active/knowledge-center.sh" restart || true; fi
  exit "$code"
}
trap restore ERR
[[ -x "$candidate/knowledge-center.sh" ]] || { echo "错误：版本不存在：$version" >&2; exit 1; }
mkdir -p "$shared/config/knowledge-center" "$shared/config/yashandb"
if [[ ! -f "$shared/config/knowledge-center/.env" && -f "$base/config/knowledge-center/.env" ]]; then install -m 600 "$base/config/knowledge-center/.env" "$shared/config/knowledge-center/.env"; fi
if [[ ! -f "$shared/config/yashandb/service.env" && -f "$base/config/yashandb/service.env" ]]; then install -m 600 "$base/config/yashandb/service.env" "$shared/config/yashandb/service.env"; fi
[[ -f "$shared/config/knowledge-center/.env" && -f "$shared/config/yashandb/service.env" ]] || { echo '错误：缺少生产共享配置' >&2; exit 1; }
chmod 600 "$shared/config/knowledge-center/.env" "$shared/config/yashandb/service.env"
[[ -z "$active" ]] || "$active/knowledge-center.sh" stop
if [[ ! -e "$shared/runtime" ]]; then
  if [[ -d "$base/runtime" && ! -L "$base/runtime" ]]; then mv "$base/runtime" "$shared/runtime"; else mkdir -p "$shared/runtime"; fi
fi
rm -rf "$candidate/runtime"; ln -s "$shared/runtime" "$candidate/runtime"
rm -f "$candidate/config/knowledge-center/.env" "$candidate/config/yashandb/service.env"
ln -s "$shared/config/knowledge-center/.env" "$candidate/config/knowledge-center/.env"
ln -s "$shared/config/yashandb/service.env" "$candidate/config/yashandb/service.env"
cd "$candidate"; npm ci; ./tools/repository/build-knowledge-center.sh
switch_current "$candidate"
./knowledge-center.sh restart --no-build
./knowledge-center.sh status --verbose
trap - ERR; echo "$action 完成：$version"; echo "发布日志：$log"
REMOTE
}

if [[ "$MODE" == rollback ]]; then
  [[ "$ROLLBACK_VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$ ]] || { echo '错误：回退版本格式无效' >&2; exit 2; }
  release rollback "$ROLLBACK_VERSION"; exit 0
fi
plan
remote_release="$DEPLOY_ROOT/releases/$VERSION"
ssh "\${SSH_ARGS[@]}" "$TARGET" "mkdir -p -- '$remote_release'"
rsync -a --delete --itemize-changes --exclude='/.git/' --exclude='/external/' --exclude='/runtime/' \
  --exclude='/node_modules/' --exclude='*.env' --exclude='service.env' --exclude='*.pem' \
  --exclude='*.key' --exclude='*.log' -e "$RSYNC_SSH" "$REPO_ROOT/" "$TARGET:$remote_release/"
release apply "$VERSION"
