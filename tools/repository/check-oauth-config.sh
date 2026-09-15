#!/usr/bin/env bash
# 检查 GitLab 认证配置状态

echo "=========================================="
echo "  GitLab 认证配置检查"
echo "=========================================="
echo ""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${KNOWLEDGE_CENTER_ENV_FILE:-$REPO_ROOT/config/knowledge-center/.env}"
GITLAB_CONFIG="${KNOWLEDGE_CENTER_GITLAB_CONFIG:-$REPO_ROOT/runtime/knowledge-center/gitlab-connections.json}"

load_dotenv() {
    local file="$1" line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        [[ "$line" =~ ^[[:space:]]*$ || "$line" =~ ^[[:space:]]*# ]] && continue
        if [[ "$line" != *=* ]]; then
            echo "❌ 环境配置缺少等号：$file"
            return 1
        fi
        key="${line%%=*}"
        value="${line#*=}"
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
            echo "❌ 环境配置包含非法变量名：$file"
            return 1
        fi
        [[ -v "$key" ]] && continue
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"
        if [[ "$value" == \"*\" && "$value" == *\" ]]; then
            value="${value:1:${#value}-2}"
        elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
            value="${value:1:${#value}-2}"
        fi
        export "$key=$value"
    done <"$file"
}

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ 未找到 .env 文件：$ENV_FILE"
    echo "   请运行：cp config/knowledge-center/.env.example config/knowledge-center/.env"
else
    load_dotenv "$ENV_FILE" || exit 1
fi

echo "📋 当前配置："
echo ""

CLIENT_ID="${KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID:-}"
CLIENT_SECRET="${KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET:-}"
REDIRECT_URI="${KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI:-}"
DEV_HTTP="${KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP:-}"

if [[ -n "$CLIENT_ID" ]]; then
    echo "   ✅ Client ID:     ${CLIENT_ID:0:8}..."
else
    echo "   ❌ Client ID:     未配置"
fi

if [[ -n "$CLIENT_SECRET" ]]; then
    echo "   ✅ Client Secret: 已配置"
else
    echo "   ❌ Client Secret: 未配置"
fi

if [[ -n "$REDIRECT_URI" ]]; then
    echo "   ✅ Redirect URI:  $REDIRECT_URI"
else
    echo "   ❌ Redirect URI:  未配置"
fi

echo "   ℹ️  Dev HTTP:      ${DEV_HTTP:-false}"
echo ""

if [[ -n "$CLIENT_ID" && -n "$CLIENT_SECRET" && -n "$REDIRECT_URI" ]]; then
    echo "✅ OAuth 配置完整"
else
    echo "❌ OAuth 配置不完整，请运行："
    echo "   ./tools/repository/setup-gitlab-oauth.sh"
fi

echo ""
echo "📋 服务账号连接："
echo ""

if [[ ! -f "$GITLAB_CONFIG" ]]; then
    echo "   ❌ 未找到 GitLab 连接配置：$GITLAB_CONFIG"
    exit 1
fi

MISSING_SERVICE_TOKEN=0
SERVICE_CONNECTIONS=$(node - "$GITLAB_CONFIG" <<'NODE'
const fs = require('fs');
const configPath = process.argv[2];
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
for (const connection of config.connections || []) {
  if (connection.authMode === 'service_account') {
    const ref = String(connection.credentialRef || '').trim();
    const key = ref ? `GITLAB_TOKEN_${ref.replace(/[^A-Za-z0-9_]/g, '_')}` : '';
    console.log([connection.name || connection.id || '-', ref || '-', key || '-'].join('\t'));
  }
}
NODE
)

if [[ -z "$SERVICE_CONNECTIONS" ]]; then
    echo "   ℹ️  未配置服务账号认证连接"
else
    while IFS=$'\t' read -r name ref key; do
        if [[ "$ref" == "-" || "$key" == "-" ]]; then
            echo "   ❌ $name: 未配置凭证引用名"
            MISSING_SERVICE_TOKEN=1
            continue
        fi
        if [[ -n "${!key:-}" ]]; then
            echo "   ✅ $name: $key 已注入"
        else
            echo "   ❌ $name: $key 未注入"
            MISSING_SERVICE_TOKEN=1
        fi
    done <<< "$SERVICE_CONNECTIONS"
fi

if [[ "$MISSING_SERVICE_TOKEN" -ne 0 ]]; then
    exit 1
fi
