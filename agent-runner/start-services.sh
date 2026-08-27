#!/bin/bash

# 启动所有服务（后端 + 前端）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PINGCODE_BACKEND_DIR="$SCRIPT_DIR/../scripts/pingcode/web/backend"
PINGCODE_FRONTEND_DIR="$SCRIPT_DIR/../scripts/pingcode/web/frontend"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

http_ready() {
    local url="$1"
    curl -fsS --connect-timeout 1 --max-time 3 "$url" > /dev/null 2>&1
}

echo "=== Agent Runner 服务启动 ==="
echo ""

# 启动后端
echo "1. 启动后端服务 (端口 4100)..."
cd "$SCRIPT_DIR"
setsid node server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"
sleep 2

# 检查后端健康状态
if http_ready http://localhost:4100/api/health; then
    echo "   ✅ 后端服务启动成功"
else
    echo "   ❌ 后端服务启动失败，请检查日志: $LOG_DIR/backend.log"
    exit 1
fi

# 启动 PingCode 素材平台后端
echo ""
echo "2. 启动 PingCode 素材平台后端 (端口 8001)..."
if http_ready http://localhost:8001/api/health; then
    echo "   ℹ️  已存在可用服务，直接复用"
else
    cd "$PINGCODE_BACKEND_DIR"
    setsid python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 > "$LOG_DIR/pingcode-backend.log" 2>&1 &
    PINGCODE_PID=$!
    echo "   PID: $PINGCODE_PID"
    sleep 2
    if http_ready http://localhost:8001/api/health; then
        echo "   ✅ PingCode 后端服务启动成功"
    else
    echo "   ⚠️  PingCode 后端启动失败，素材平台暂不可用，请检查日志: $LOG_DIR/pingcode-backend.log"
    fi
fi

echo ""
echo "3. 构建 PingCode 素材平台前端..."
cd "$PINGCODE_FRONTEND_DIR"
if npm run build > "$LOG_DIR/pingcode-frontend-build.log" 2>&1; then
    echo "   ✅ PingCode 前端构建完成"
else
    echo "   ⚠️  PingCode 前端构建失败，继续启动文档生成器，请检查日志: $LOG_DIR/pingcode-frontend-build.log"
fi

# 启动统一前端网关
echo ""
echo "4. 启动统一前端网关 (端口 3500)..."
cd "$SCRIPT_DIR"
setsid node frontend-server.js > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
sleep 2

# 检查前端健康状态
if http_ready http://localhost:3500/prompt-generator.html; then
    echo "   ✅ 前端服务启动成功"
else
    echo "   ❌ 前端服务启动失败，请检查日志: $LOG_DIR/frontend.log"
    exit 1
fi

# 显示服务状态
echo ""
echo "=== 服务状态 ==="
echo "后端 API:  http://192.168.130.180:4100/api/health"
echo "文档生成器: http://192.168.130.180:3500/prompt-generator.html"
echo "素材平台:   http://192.168.130.180:3500/pingcode-materials/"
echo ""
echo "日志文件:"
echo "  后端: $LOG_DIR/backend.log"
echo "  前端: $LOG_DIR/frontend.log"
echo "  PingCode 后端: $LOG_DIR/pingcode-backend.log"
echo "  PingCode 构建: $LOG_DIR/pingcode-frontend-build.log"
echo ""
echo "✅ 所有服务已启动"
