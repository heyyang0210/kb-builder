#!/bin/bash

# 只启动后端服务（同时提供 API 和前端静态文件）
cd /data/docs/AI高效应用示例/06-YashanDB知识库Skill仓库/scripts/pingcode/web/backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 3500 > /tmp/backend_3500.log 2>&1 &
BACKEND_PID=$!
echo "后端服务已启动 (PID: $BACKEND_PID)"

echo ""
echo "服务访问地址："
echo "  API:    http://192.168.130.180:3500/api/health"
echo "  前端:   http://192.168.130.180:3500/pingcode-materials/"
echo ""
echo "按 Ctrl+C 停止服务"

wait
