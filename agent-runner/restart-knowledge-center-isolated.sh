#!/usr/bin/env bash

# Knowledge Center branch-isolated service restart.

# Load environment variables from .env file if it exists
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/agent-runner/.env"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi
# Only processes recorded by this script are stopped. An unknown process
# listening on a target port is treated as a safety failure.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="${KNOWLEDGE_CENTER_LOG_DIR:-$SCRIPT_DIR/logs/knowledge-center-isolated}"
STATE_DIR="${KNOWLEDGE_CENTER_STATE_DIR:-$SCRIPT_DIR/.runtime/knowledge-center-isolated}"

FRONTEND_PORT="${KNOWLEDGE_CENTER_FRONTEND_PORT:-${PORT:-13510}}"
DOCUMENT_API_PORT="${KNOWLEDGE_CENTER_DOCUMENT_API_PORT:-${DOCUMENT_API_PORT:-14110}}"
PINGCODE_API_PORT="${KNOWLEDGE_CENTER_PINGCODE_API_PORT:-${PINGCODE_API_PORT:-18010}}"
AUTH_API_PORT="${KNOWLEDGE_CENTER_AUTH_PORT:-14200}"
INTERNAL_HOST="${KNOWLEDGE_CENTER_INTERNAL_HOST:-127.0.0.1}"
PUBLIC_HOST="${KNOWLEDGE_CENTER_PUBLIC_HOST:-192.168.130.180}"
PINGCODE_HOST="${KNOWLEDGE_CENTER_PINGCODE_HOST:-127.0.0.1}"
STOP_TIMEOUT="${KNOWLEDGE_CENTER_STOP_TIMEOUT:-8}"
OUTLINE_INTERNAL_TOKEN="${KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN:-$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")}" 
WSL_IP="${KNOWLEDGE_CENTER_WSL_IP:-$(hostname -I 2>/dev/null | awk '{print $1}') }"
WSL_IP="${WSL_IP// /}"

mkdir -p "$LOG_DIR" "$STATE_DIR"

http_ready() {
  curl -fsS --connect-timeout 1 --max-time 3 "$1" >/dev/null 2>&1
}

pid_file() { printf '%s/%s.pid' "$STATE_DIR" "$1"; }

process_matches() {
  local pid="$1" expected_cwd="$2" expected_pattern="$3"
  [[ -d "/proc/$pid" ]] || return 1
  [[ "$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)" == "$expected_cwd" ]] || return 1
  tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -F -- "$expected_pattern" >/dev/null
}

stop_recorded() {
  local name="$1" cwd="$2" pattern="$3" file pid deadline
  file="$(pid_file "$name")"
  [[ -f "$file" ]] || return 0
  pid="$(cat "$file" 2>/dev/null || true)"
  if [[ -z "$pid" || ! "$pid" =~ ^[0-9]+$ ]]; then
    rm -f "$file"
    return 0
  fi
  if ! process_matches "$pid" "$cwd" "$pattern"; then
    echo "警告：忽略不属于本分支的 PID $pid（$name），不执行停止操作" >&2
    rm -f "$file"
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  deadline=$((SECONDS + STOP_TIMEOUT))
  while kill -0 "$pid" 2>/dev/null && (( SECONDS < deadline )); do sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then
    echo "错误：$name 未在 ${STOP_TIMEOUT}s 内退出，拒绝强制杀进程" >&2
    return 1
  fi
  rm -f "$file"
}

assert_port_available() {
  local port="$1" listener
  listener="$(ss -ltnp "sport = :$port" 2>/dev/null || true)"
  if grep -q "LISTEN" <<<"$listener"; then
    echo "错误：端口 $port 已被占用；仅允许使用本脚本记录的进程，未执行任何停止操作" >&2
    ss -ltnp "sport = :$port" >&2 || true
    return 1
  fi
}

start_service() {
  local name="$1" cwd="$2" logfile="$3"; shift 3
  pushd "$cwd" >/dev/null
  setsid "$@" >"$logfile" 2>&1 &
  local pid=$!
  popd >/dev/null
  echo "$pid" >"$(pid_file "$name")"
}

wait_or_fail() {
  local name="$1" url="$2" required="$3"; shift 3
  local attempts="${1:-30}"
  for _ in $(seq 1 "$attempts"); do
    if http_ready "$url"; then echo "✅ $name 已就绪"; return 0; fi
    sleep 1
  done
  if [[ "$required" == true ]]; then
    echo "❌ $name 启动失败，日志：$LOG_DIR/$name.log" >&2
    return 1
  fi
  echo "⚠️  $name 不可用，继续运行（日志：$LOG_DIR/$name.log）" >&2
}

print_host_forwarding_hint() {
  [[ "$PUBLIC_HOST" != "$INTERNAL_HOST" ]] || return 0
  [[ -n "$WSL_IP" ]] || { echo "⚠️ 无法自动识别 WSL 地址，请设置 KNOWLEDGE_CENTER_WSL_IP" >&2; return 0; }
  cat >&2 <<EOF
⚠️ 局域网入口尚未从宿主机验证：$PUBLIC_HOST:$FRONTEND_PORT
请在 Windows“管理员 PowerShell”执行以下命令（WSL 重启后 IP 变化时需更新 connectaddress）：
  netsh interface portproxy delete v4tov4 listenaddress=$PUBLIC_HOST listenport=$FRONTEND_PORT
  netsh interface portproxy add v4tov4 listenaddress=$PUBLIC_HOST listenport=$FRONTEND_PORT connectaddress=$WSL_IP connectport=$FRONTEND_PORT
  New-NetFirewallRule -DisplayName "Knowledge Center $FRONTEND_PORT" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $FRONTEND_PORT -Profile Private
验证命令：Test-NetConnection -ComputerName $PUBLIC_HOST -Port $FRONTEND_PORT
EOF
}

echo "=== 知识中心管理平台隔离重启 ==="
echo "前端=$FRONTEND_PORT 认证API=$AUTH_API_PORT 文档API=$DOCUMENT_API_PORT 资料加工API=$PINGCODE_API_PORT"
echo "局域网入口=http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/"

stop_recorded frontend "$SCRIPT_DIR" "node frontend-server.js"
stop_recorded auth "$SCRIPT_DIR" "node auth-server.js"
stop_recorded document "$SCRIPT_DIR" "node server.js"
stop_recorded pingcode "$REPO_ROOT/scripts/pingcode/web/backend" "uvicorn app.main:app"

assert_port_available "$FRONTEND_PORT"
assert_port_available "$AUTH_API_PORT"
assert_port_available "$DOCUMENT_API_PORT"
assert_port_available "$PINGCODE_API_PORT"

start_service document "$SCRIPT_DIR" "$LOG_DIR/document.log" env PORT="$DOCUMENT_API_PORT" HOST="$INTERNAL_HOST" KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$OUTLINE_INTERNAL_TOKEN" node server.js
wait_or_fail document "http://$INTERNAL_HOST:$DOCUMENT_API_PORT/api/health" true

start_service pingcode "$REPO_ROOT/scripts/pingcode/web/backend" "$LOG_DIR/pingcode.log" env PINGCODE_WEB_PORT="$PINGCODE_API_PORT" PINGCODE_WEB_HOST="$PINGCODE_HOST" python3 -m uvicorn app.main:app --host "$PINGCODE_HOST" --port "$PINGCODE_API_PORT"
wait_or_fail pingcode "http://$PINGCODE_HOST:$PINGCODE_API_PORT/api/health" false

start_service auth "$SCRIPT_DIR" "$LOG_DIR/auth.log" env KNOWLEDGE_CENTER_AUTH_PORT="$AUTH_API_PORT" KNOWLEDGE_CENTER_AUTH_HOST="$INTERNAL_HOST" KNOWLEDGE_CENTER_SERVICE_URL="http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/" KNOWLEDGE_CENTER_COOKIE_SECURE=false node auth-server.js
wait_or_fail auth "http://$INTERNAL_HOST:$AUTH_API_PORT/knowledge-center/api/auth/config" true

start_service frontend "$SCRIPT_DIR" "$LOG_DIR/frontend.log" env PORT="$FRONTEND_PORT" DOCUMENT_API_HOST="$INTERNAL_HOST" DOCUMENT_API_PORT="$DOCUMENT_API_PORT" PINGCODE_API_PORT="$PINGCODE_API_PORT" KNOWLEDGE_CENTER_AUTH_HOST="$INTERNAL_HOST" KNOWLEDGE_CENTER_AUTH_PORT="$AUTH_API_PORT" KNOWLEDGE_CENTER_OUTLINE_INTERNAL_TOKEN="$OUTLINE_INTERNAL_TOKEN" KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID="$KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID" KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET="$KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET" KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI="$KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI" KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES="$KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES" KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP="$KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP" node frontend-server.js
wait_or_fail frontend "http://$INTERNAL_HOST:$FRONTEND_PORT/knowledge-center/" true

echo "局域网入口：http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/"
echo "本机健康检查：http://$INTERNAL_HOST:$FRONTEND_PORT/knowledge-center/"
if [[ "$PUBLIC_HOST" != "$INTERNAL_HOST" ]] && ! curl -fsS --connect-timeout 1 --max-time 1 "http://$PUBLIC_HOST:$FRONTEND_PORT/knowledge-center/" >/dev/null 2>&1; then
  print_host_forwarding_hint
fi
echo "状态目录：$STATE_DIR"
echo "日志目录：$LOG_DIR"
