#!/usr/bin/env bash
# GitLab OAuth 交互式配置脚本
# 适用于知识中心管理平台

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/config/knowledge-center/.env"

echo "=========================================="
echo "  GitLab OAuth 配置向导"
echo "=========================================="
echo ""

# 检查 .env 文件是否存在
if [[ ! -f "$ENV_FILE" ]]; then
    echo "📋 未找到 .env 文件，正在从模板创建..."
    cp "$REPO_ROOT/config/knowledge-center/.env.example" "$ENV_FILE"
    echo "✅ 已创建：$ENV_FILE"
    echo ""
fi

echo "🔧 请准备以下信息（从 GitLab 获取）："
echo "   1. Application ID（客户端 ID）"
echo "   2. Secret（客户端密钥）"
echo ""
echo "📖 如何在 GitLab 创建 OAuth Application："
echo "   1. 登录 GitLab：https://git-tools.yasdb.com"
echo "   2. 点击右上角头像 → Preferences → Applications"
echo "   3. 点击 New application"
echo "   4. 填写："
echo "      - Name: 知识中心管理平台"
echo "      - Redirect URI: http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback"
echo "      - Scopes: 勾选 read_api 和 read_repository"
echo "   5. 点击 Save application，复制 Application ID 和 Secret"
echo ""
read -p "按回车键继续..."

echo ""
echo "=========================================="
echo "  配置 OAuth 凭证"
echo "=========================================="
echo ""

# 读取 Application ID
read -p "请输入 Application ID: " CLIENT_ID
if [[ -z "$CLIENT_ID" ]]; then
    echo "❌ Application ID 不能为空"
    exit 1
fi

# 读取 Secret
read -sp "请输入 Secret: " CLIENT_SECRET
echo ""
if [[ -z "$CLIENT_SECRET" ]]; then
    echo "❌ Secret 不能为空"
    exit 1
fi

# 读取回调地址（提供默认值）
echo ""
echo "回调地址（直接回车使用默认值）："
read -p "Redirect URI: " REDIRECT_URI
REDIRECT_URI="${REDIRECT_URI:-http://192.168.130.180:13510/knowledge-center/api/gitlab/oauth/callback}"

# 更新 .env 文件
echo ""
echo " 正在更新配置文件..."

# 如果配置项已存在则更新，否则追加
update_or_append() {
    local key="$1"
    local value="$2"
    if grep -q "^$key=" "$ENV_FILE" 2>/dev/null; then
        sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
    else
        echo "$key=$value" >> "$ENV_FILE"
    fi
}

update_or_append "KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_ID" "$CLIENT_ID"
update_or_append "KNOWLEDGE_CENTER_GITLAB_OAUTH_CLIENT_SECRET" "$CLIENT_SECRET"
update_or_append "KNOWLEDGE_CENTER_GITLAB_OAUTH_REDIRECT_URI" "$REDIRECT_URI"
update_or_append "KNOWLEDGE_CENTER_GITLAB_OAUTH_SCOPES" "read_api read_repository"
update_or_append "KNOWLEDGE_CENTER_GITLAB_OAUTH_DEV_HTTP" "true"

echo "✅ 配置已保存到：$ENV_FILE"
echo ""

# 显示配置摘要
echo "=========================================="
echo "  配置摘要"
echo "=========================================="
echo "Client ID:     ${CLIENT_ID:0:8}..."
echo "Secret:        已配置"
echo "Redirect URI:  $REDIRECT_URI"
echo "Scopes:        read_api read_repository"
echo "Dev HTTP:      true"
echo ""

# 询问是否重启服务
read -p "是否立即重启服务？(y/N): " RESTART
if [[ "$RESTART" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔄 正在重启服务..."
    cd "$REPO_ROOT"
    "$REPO_ROOT/knowledge-center.sh" restart
    echo ""
    echo "✅ 服务已重启"
else
    echo ""
    echo "📋 稍后请手动重启服务："
    echo "   cd $REPO_ROOT"
    echo "   $REPO_ROOT/knowledge-center.sh restart"
fi

echo ""
echo "=========================================="
echo "  配置完成！"
echo "=========================================="
echo ""
echo " 验证配置："
echo "   1. 访问 http://192.168.130.180:13510/knowledge-center/platform"
echo "   2. 点击"连接 GitLab 账号"按钮"
echo "   3. 应跳转到 GitLab 授权页面"
echo ""
echo "📖 详细文档：docs/gitlab-oauth-setup-guide.md"
echo ""
