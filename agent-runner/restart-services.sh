#!/bin/bash

# 重启所有服务（后端 + 前端）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PINGCODE_BACKEND_DIR="$SCRIPT_DIR/../scripts/pingcode/web/backend"
PINGCODE_FRONTEND_DIR="$SCRIPT_DIR/../scripts/pingcode/web/frontend"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

echo "=== Agent Runner 服务重启 ==="
echo ""

# 停止现有服务。按完整命令匹配，避免 pkill -f 把重启脚本自身或相似命令误杀。
stop_processes() {
    local pattern="$1"
    local pid
    while read -r pid; do
        [ -n "$pid" ] || continue
        kill "$pid" 2>/dev/null || true
    done < <(pgrep -x -f "$pattern" 2>/dev/null || true)
}

http_ready() {
    local url="$1"
    curl -fsS --connect-timeout 1 --max-time 3 "$url" > /dev/null 2>&1
}

# 停止现有服务
echo "1. 停止现有服务..."
stop_processes 'node server.js' && echo "   ✅ 后端服务已停止" || echo "   ℹ️  后端服务未运行"
stop_processes 'node frontend-server.js' && echo "   ✅ 前端服务已停止" || echo "   ℹ️  前端服务未运行"
stop_processes 'python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001' && echo "   ✅ PingCode 后端已停止" || echo "   ℹ️  PingCode 后端未运行"
sleep 2

# 启动后端
echo ""
echo "2. 启动后端服务 (端口 4100)..."
cd "$SCRIPT_DIR"
setsid node server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

# 检查后端健康状态
BACKEND_READY=false
for _ in $(seq 1 30); do
    if http_ready http://localhost:4100/api/health; then
        BACKEND_READY=true
        break
    fi
    sleep 1
done
if [ "$BACKEND_READY" = true ]; then
    echo "   ✅ 后端服务启动成功"
else
    echo "   ❌ 后端服务启动失败，请检查日志: $LOG_DIR/backend.log"
    exit 1
fi

# 启动 PingCode 素材平台后端
echo ""
echo "3. 启动 PingCode 素材平台后端 (端口 8001)..."
cd "$PINGCODE_BACKEND_DIR"
setsid python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001 > "$LOG_DIR/pingcode-backend.log" 2>&1 &
PINGCODE_PID=$!
echo "   PID: $PINGCODE_PID"

PINGCODE_READY=false
for _ in $(seq 1 30); do
    if http_ready http://localhost:8001/api/health; then
        PINGCODE_READY=true
        break
    fi
    sleep 1
done
if [ "$PINGCODE_READY" = true ]; then
    echo "   ✅ PingCode 后端服务启动成功"
else
    # PingCode 只承载素材平台，不应阻断文档生成器的 3500/4100 主链路。
    echo "   ⚠️  PingCode 后端启动失败，素材平台暂不可用，请检查日志: $LOG_DIR/pingcode-backend.log"
fi

echo ""
echo "4. 构建 PingCode 素材平台前端..."
cd "$PINGCODE_FRONTEND_DIR"
if npm run build > "$LOG_DIR/pingcode-frontend-build.log" 2>&1; then
    echo "   ✅ PingCode 前端构建完成"
else
    echo "   ⚠️  PingCode 前端构建失败，继续启动文档生成器，请检查日志: $LOG_DIR/pingcode-frontend-build.log"
fi

# 启动统一前端网关
echo ""
echo "5. 启动统一前端网关 (端口 3500)..."
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
