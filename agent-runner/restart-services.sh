#!/bin/bash

# 重启所有服务（后端 + 前端）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"

# 确保日志目录存在
mkdir -p "$LOG_DIR"

echo "=== Agent Runner 服务重启 ==="
echo ""

# 停止现有服务
echo "1. 停止现有服务..."
pkill -f "node server.js" 2>/dev/null && echo "   ✅ 后端服务已停止" || echo "   ℹ️  后端服务未运行"
pkill -f "node frontend-server.js" 2>/dev/null && echo "   ✅ 前端服务已停止" || echo "   ℹ️  前端服务未运行"
sleep 2

# 启动后端
echo ""
echo "2. 启动后端服务 (端口 4100)..."
cd "$SCRIPT_DIR"
setsid node server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"
sleep 2

# 检查后端健康状态
if curl -s http://localhost:4100/api/health > /dev/null 2>&1; then
    echo "   ✅ 后端服务启动成功"
else
    echo "   ❌ 后端服务启动失败，请检查日志: $LOG_DIR/backend.log"
    exit 1
fi

# 启动前端
echo ""
echo "3. 启动前端服务 (端口 3500)..."
setsid node frontend-server.js > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
sleep 2

# 检查前端健康状态
if curl -s http://localhost:3500/ > /dev/null 2>&1; then
    echo "   ✅ 前端服务启动成功"
else
    echo "   ❌ 前端服务启动失败，请检查日志: $LOG_DIR/frontend.log"
    exit 1
fi

# 显示服务状态
echo ""
echo "=== 服务状态 ==="
echo "后端 API:  http://192.168.130.180:4100/api/health"
echo "前端页面:  http://192.168.130.180:3500/prompt-generator.html"
echo ""
echo "日志文件:"
echo "  后端: $LOG_DIR/backend.log"
echo "  前端: $LOG_DIR/frontend.log"
echo ""
echo "✅ 所有服务已启动"
