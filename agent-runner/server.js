require('dotenv').config();

const { loadProfile } = require('./lib/platform-profile/profile-loader');
const platformProfile = loadProfile();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketServer } = require('socket.io');
const path = require('path');
const fs = require('fs');

const logger = require('./lib/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

const configRoutes = require('./routes/config');
const agentRoutes = require('./routes/agent');
const outlineRoutes = require('./routes/outline');
const workflowRoutes = require('./routes/workflow');
const documentRoutes = require('./routes/document');
const modelProviderRoutes = require('./routes/model-provider');
const ToolManager = require('./lib/tools/tool-manager');

// 全局错误处理（防止未捕获异常导致进程退出）
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason: reason?.message || reason, stack: reason?.stack });
});

const PORT = process.env.PORT || 4100;
const HOST = process.env.HOST || '0.0.0.0';

// 业务模块只读取启动时冻结的脱敏上下文，不自行读取能力包文件。
Object.defineProperty(global, '__KNOWLEDGE_PLATFORM_CONTEXT__', {
  value: platformProfile.context,
  writable: false,
  configurable: false
});

// 确保必要目录存在
['config', 'logs', 'tmp'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// 初始化工具管理器
const toolManager = new ToolManager({
  basePath: path.join(__dirname, '..'),
  mcp: {} // Will be loaded from config
});

// 创建 Express 应用
const app = express();
const httpServer = createServer(app);

// Socket.IO 配置
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// 中间件
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 频率限制
const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' }
  }
});

// 路由
app.use('/api/config', configRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/outline', outlineRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/document', documentRoutes);
app.use('/api/model-provider', modelProviderRoutes);

// 健康检查（无限流）
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 静态文件服务（用于前端预览生成的文件）
const outputDir = path.join(__dirname, '..', 'output');
if (fs.existsSync(outputDir)) {
  app.use('/preview', express.static(outputDir));
  logger.info("Output directory: " + outputDir);
}

// Socket.IO 连接处理
io.on('connection', (socket) => {
  logger.info(`WebSocket client connected: ${socket.id}`);

  socket.on('subscribe', (data) => {
    if (data.task_id) {
      socket.join(`task:${data.task_id}`);
      logger.debug(`Socket ${socket.id} subscribed to task ${data.task_id}`);
    }
  });

  socket.on('unsubscribe', (data) => {
    if (data.task_id) {
      socket.leave(`task:${data.task_id}`);
    }
  });

  socket.on('disconnect', () => {
    logger.debug(`WebSocket client disconnected: ${socket.id}`);
  });
});

// 将 io 实例注入到 agent 路由
require("./routes/agent").setIO(io);
app.set("io", io);
app.set('io', io);

// 404 和错误处理
app.use(notFoundHandler);
app.use(errorHandler);

// 启动服务
httpServer.on('error', (error) => {
  logger.error('HTTP Server error:', { error: error.message, code: error.code });
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please use a different port.`);
  }
  process.exit(1);
});

httpServer.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  logger.info(`Agent Runner server started at http://${displayHost}:${PORT}`);
  logger.info(`WebSocket available at ws://${displayHost}:${PORT}`);
  logger.info(`Health check: http://${displayHost}:${PORT}/api/health`);
});

// 优雅关闭
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  
  // 10 秒后强制退出
  const shutdownTimeout = setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  
  httpServer.close(() => {
    clearTimeout(shutdownTimeout);
    logger.info('Server closed');
    process.exit(0);
  });
  
  // 关闭 Socket.IO
  io.close();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, httpServer, io };
