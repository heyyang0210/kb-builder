#!/usr/bin/env bash
# 检查 GitLab OAuth 配置状态

echo "=========================================="
echo "  GitLab OAuth 配置检查"
echo "=========================================="
echo ""

ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/agent-runner/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "❌ 未找到 .env 文件：$ENV_FILE"
    echo "   请运行：cp agent-runner/.env.example agent-runner/.env"
    exit 1
fi

echo "📋 当前配置："
echo ""

CLIENT_ID=$(grep "^KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID=" "$ENV_FILE" | cut -d'=' -f2)
CLIENT_SECRET=$(grep "^KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET=" "$ENV_FILE" | cut -d'=' -f2)
REDIRECT_URI=$(grep "^KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI=" "$ENV_FILE" | cut -d'=' -f2)
DEV_HTTP=$(grep "^KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP=" "$ENV_FILE" | cut -d'=' -f2)

if [[ -n "$CLIENT_ID" ]]; then
    echo "   ✅ Client ID:     ${CLIENT_ID:0:8}..."
else
    echo "   ❌ Client ID:     未配置"
fi

if [[ -n "$CLIENT_SECRET" ]]; then
    echo "   ✅ Client Secret: ${CLIENT_SECRET:0:8}..."
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
    echo "   ./scripts/setup-gitlab-oauth.sh"
fi
