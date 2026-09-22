#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TASK_RUNTIME=$(mktemp -d /tmp/knowledge-center-database-api.XXXXXX)
TASK_PORT=$(node -e "const net=require('net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{console.log(server.address().port);server.close();});")
TASK_SUFFIX=$(node -e "process.stdout.write(require('crypto').randomBytes(6).toString('hex'))")
TASK_ADMIN_USERNAME="api-review-$TASK_SUFFIX"
TASK_ADMIN_PASSWORD=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('base64url'))")
TASK_EDITOR_USERNAME="api-editor-$TASK_SUFFIX"
TASK_EDITOR_PASSWORD=$(node -e "process.stdout.write(require('crypto').randomBytes(24).toString('base64url'))")
SERVER_PID=''

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [[ -d "$TASK_RUNTIME" ]]; then
    find "$TASK_RUNTIME" -depth -delete
  fi
}
trap cleanup EXIT INT TERM

cd "$REPOSITORY_ROOT"
env \
  PORT="$TASK_PORT" \
  KNOWLEDGE_STORAGE_MODE=file \
  KNOWLEDGE_CENTER_PUBLIC_HOST=127.0.0.1 \
  KNOWLEDGE_CENTER_COOKIE_SECURE=false \
  KNOWLEDGE_CENTER_ENVIRONMENT=test \
  KNOWLEDGE_CENTER_TEST_RUN_ID=database-api-contract \
  KNOWLEDGE_CENTER_ADMIN_USERNAME="$TASK_ADMIN_USERNAME" \
  KNOWLEDGE_CENTER_ADMIN_PASSWORD="$TASK_ADMIN_PASSWORD" \
  KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_USERNAME="$TASK_EDITOR_USERNAME" \
  KNOWLEDGE_CENTER_KNOWLEDGE_EDITOR_PASSWORD="$TASK_EDITOR_PASSWORD" \
  KNOWLEDGE_CENTER_AUTH_STORE="$TASK_RUNTIME/auth.json" \
  YASDB_CONFIG_DIR="$TASK_RUNTIME/yashandb" \
  node apps/knowledge-center-web/frontend-server.js >"$TASK_RUNTIME/server.log" 2>&1 &
SERVER_PID=$!

BASE_URL="http://127.0.0.1:$TASK_PORT"
ready=false
for _attempt in $(seq 1 50); do
  if curl --silent --fail "$BASE_URL/knowledge-center/api/auth/config" >/dev/null 2>&1; then
    ready=true
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    cat "$TASK_RUNTIME/server.log" >&2
    echo '错误：隔离知识中心实例启动失败。' >&2
    exit 1
  fi
  sleep 0.1
done
if [[ "$ready" != true ]]; then
  cat "$TASK_RUNTIME/server.log" >&2
  echo '错误：隔离知识中心实例未在预期时间内就绪。' >&2
  exit 1
fi

BASE_URL="$BASE_URL" API_REVIEW_USERNAME="$TASK_ADMIN_USERNAME" API_REVIEW_PASSWORD="$TASK_ADMIN_PASSWORD" node <<'NODE'
const assert = require('assert/strict');

(async () => {
  const baseUrl = process.env.BASE_URL;
  const username = process.env.API_REVIEW_USERNAME;
  const password = process.env.API_REVIEW_PASSWORD;
  const login = await fetch(`${baseUrl}/knowledge-center/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.status, 200, '管理员登录应成功');
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0] || '';
  assert.match(cookie, /^kc_session=/, '管理员登录应返回会话 Cookie');

  const startedAt = Date.now();
  const statusResponse = await fetch(`${baseUrl}/knowledge-center/api/platform/database-connection/status`, { headers: { cookie } });
  const statusPayload = await statusResponse.json();
  assert.equal(statusResponse.status, 200, '状态快照读取应成功');
  assert.equal(statusPayload?.data?.healthStatus, 'unconfigured', '隔离实例应返回未配置状态');
  assert.ok(Date.now() - startedAt < 1000, '状态快照读取不应等待现场 JDBC 探测');

  const refreshResponse = await fetch(`${baseUrl}/knowledge-center/api/platform/database-connection/status`, { method: 'POST', headers: { cookie } });
  const refreshPayload = await refreshResponse.json();
  assert.equal(refreshResponse.status, 200, '管理员主动刷新应成功');
  assert.equal(refreshPayload?.data?.healthStatus, 'unconfigured', '未配置实例主动刷新后仍应为未配置');

  const unsupportedResponse = await fetch(`${baseUrl}/knowledge-center/api/platform/database-connection/status`, { method: 'PUT', headers: { cookie } });
  assert.equal(unsupportedResponse.status, 405, '状态子路由应拒绝 PUT');
  assert.equal(unsupportedResponse.headers.get('allow'), 'GET, POST', '状态子路由应返回准确 Allow 头');

  const serialized = JSON.stringify({ statusPayload, refreshPayload });
  assert.equal(serialized.includes(password), false, '状态响应不得泄露管理员密码');
  console.log(`数据库状态真实 API 验证通过：GET ${statusResponse.status}，POST ${refreshResponse.status}，PUT ${unsupportedResponse.status}`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
NODE
