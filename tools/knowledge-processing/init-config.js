require('dotenv').config();
const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '..', '..', 'config', 'agent-runner');

if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

const defaults = {
  'model-config.json': {
    provider: 'openai',
    model: 'gpt-4',
    base_url: 'https://api.openai.com/v1',
    temperature: 0.7,
    max_tokens: 4000,
    timeout: 60000,
    providers: {
      openai: {
        name: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
      },
      alibaba: {
        name: '阿里云百炼',
        base_url: 'https://dashscope.aliyuncs.com/api/v1',
        models: ['qwen-max', 'qwen-plus', 'qwen-turbo']
      },
      zhipu: {
        name: '智谱 AI',
        base_url: 'https://open.bigmodel.cn/api/paas/v4',
        models: ['glm-4', 'glm-3-turbo']
      }
    }
  },
  'mcp-config.json': {
    server_url: 'https://knowledgebase.yashandb.com/api/mcp',
    timeout: 30000,
    retry_count: 3,
    cache: {
      enabled: true,
      ttl: 3600,
      max_size: 1000
    }
  },
  'agent-presets.json': {
    presets: [
      {
        id: 'default',
        name: '默认4步流程',
        description: '标准的文档生成流程',
        steps: [
          { name: 'planner', agent: 'planner', config: { model: 'gpt-4', temperature: 0.3 } },
          { name: 'retriever', agent: 'retriever', config: { model: 'gpt-3.5-turbo' } },
          { name: 'generator', agent: 'generator', config: { model: 'gpt-4', temperature: 0.7 } },
          { name: 'validator', agent: 'validator', config: { model: 'gpt-4', temperature: 0.2 } }
        ]
      },
      {
        id: 'fast',
        name: '快速生成',
        description: '跳过验证步骤，快速生成文档',
        steps: [
          { name: 'planner', agent: 'planner', config: {} },
          { name: 'retriever', agent: 'retriever', config: {} },
          { name: 'generator', agent: 'generator', config: {} }
        ]
      }
    ],
    default_preset: 'default'
  },
  'system-config.json': {
    server: { port: 4100, host: 'localhost' },
    security: {
      encryption_key_env: 'AGENT_RUNNER_KEY',
      cors_origins: ['http://localhost:*', 'http://127.0.0.1:*'],
      rate_limit: { window_ms: 60000, max_requests: 10 }
    },
    logging: {
      level: 'info',
      file: 'logs/execution.log',
      max_size: '10m',
      max_files: 5
    },
    paths: {
      output: '../output',
      templates: '../templates',
      references: '../references'
    }
  }
};

let created = 0;
let skipped = 0;

for (const [filename, content] of Object.entries(defaults)) {
  const filePath = path.join(configDir, filename);
  if (fs.existsSync(filePath)) {
    console.log(`  ⏭️  ${filename} (已存在，跳过)`);
    skipped++;
  } else {
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
    console.log(`  ✅ ${filename} (已创建)`);
    created++;
  }
}

console.log(`\n初始化完成: 创建 ${created} 个, 跳过 ${skipped} 个`);
