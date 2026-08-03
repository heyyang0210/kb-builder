#!/usr/bin/env node

/**
 * 资料预处理 CLI 入口
 * 
 * 用法：
 *   node scripts/preprocess.js run design-docs              # 执行设计文档预处理
 *   node scripts/preprocess.js run design-docs --full       # 强制全量
 *   node scripts/preprocess.js run design-docs --dry-run    # 预览模式
 *   node scripts/preprocess.js run-all                      # 执行所有 Pipeline
 *   node scripts/preprocess.js snapshots design-docs        # 列出快照
 *   node scripts/preprocess.js rollback design-docs --snapshot <id>
 *   node scripts/preprocess.js logs [pipeline] [--last N]
 */

const path = require('path');
const fs = require('fs');
const { PreprocessingEngine } = require('../lib/preprocessing');
const { DesignDocPipeline } = require('../lib/preprocessing/pipelines/design-doc-pipeline');

// === 参数解析 ===

const args = process.argv.slice(2);
const command = args[0];
const pipelineName = args[1];

function hasFlag(flag) {
  return args.includes(`--${flag}`);
}

function getFlagValue(flag) {
  const index = args.indexOf(`--${flag}`);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

// === 加载配置 ===

const BASE_DIR = path.join(__dirname, '..');
const configPath = path.join(BASE_DIR, 'config', 'preprocessing-config.json');

let config;
try {
  const configContent = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(configContent);
} catch (err) {
  console.error(`配置文件加载失败: ${configPath}`, err.message);
  process.exit(1);
}

// 解析 source.inputDir 为绝对路径
if (config.pipelines?.['design-docs']?.source?.inputDir) {
  config.pipelines['design-docs'].source.inputDir = path.resolve(
    BASE_DIR,
    config.pipelines['design-docs'].source.inputDir
  );
}

// 设置绝对路径
config.baseDir = BASE_DIR;
config.logDir = path.join(BASE_DIR, config.engine?.logDir || 'logs/preprocessing');
config.snapshotDir = path.join(BASE_DIR, config.engine?.snapshotDir || 'preprocessing-output/_snapshots');
config.reportDir = path.join(BASE_DIR, config.engine?.reportDir || 'preprocessing-output/_reports');

// === 初始化引擎 ===

const engine = new PreprocessingEngine(config);

// 注册 Pipeline
engine.register(new DesignDocPipeline(config.pipelines?.['design-docs'] || {}));

// === 命令执行 ===

async function main() {
  switch (command) {
    case 'run': {
      if (!pipelineName) {
        console.error('用法: node scripts/preprocess.js run <pipeline> [--full] [--dry-run]');
        process.exit(1);
      }

      const options = {
        full: hasFlag('full'),
        dryRun: hasFlag('dry-run')
      };

      console.log(`\n🚀 执行预处理: ${pipelineName}`);
      console.log(`   模式: ${options.full ? '全量' : '增量'}${options.dryRun ? ' (预览)' : ''}`);
      console.log('');

      try {
        const report = await engine.run(pipelineName, options);
        printReport(report);
      } catch (err) {
        console.error(`\n❌ 执行失败: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'run-all': {
      const options = {
        full: hasFlag('full'),
        dryRun: hasFlag('dry-run')
      };

      console.log(`\n🚀 执行所有预处理流水线`);
      console.log(`   已注册: ${engine.listPipelines().join(', ')}`);
      console.log('');

      try {
        const reports = await engine.runAll(options);
        for (const report of reports) {
          printReport(report);
        }
      } catch (err) {
        console.error(`\n❌ 执行失败: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'snapshots': {
      const name = pipelineName || 'design-docs';
      const snapshots = await engine.listSnapshots(name);

      if (snapshots.length === 0) {
        console.log(`\n📋 ${name}: 暂无快照记录`);
        break;
      }

      console.log(`\n📋 ${name} 执行快照（最近 ${snapshots.length} 个）:\n`);
      console.log('  ID                              | 时间                | 耗时    | 文件数');
      console.log('  --------------------------------|---------------------|---------|------');
      for (const snap of snapshots) {
        const id = snap.snapshot_id.padEnd(32);
        const time = snap.executed_at.replace('T', ' ').slice(0, 19);
        const duration = `${(snap.duration_ms / 1000).toFixed(1)}s`.padEnd(8);
        const files = snap.input_files || 0;
        console.log(`  ${id} | ${time} | ${duration} | ${files}`);
      }
      break;
    }

    case 'rollback': {
      const name = pipelineName || 'design-docs';
      const snapshotId = getFlagValue('snapshot');

      if (!snapshotId) {
        console.error('用法: node scripts/preprocess.js rollback <pipeline> --snapshot <id>');
        process.exit(1);
      }

      console.log(`\n⏪ 回滚 ${name} 到快照 ${snapshotId}`);
      try {
        await engine.rollback(name, snapshotId);
        console.log('✅ 回滚完成');
      } catch (err) {
        console.error(`❌ 回滚失败: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'logs': {
      const name = pipelineName;
      const count = parseInt(getFlagValue('last') || '10', 10);

      const logs = await engine.readRecentLogs(name, count);

      if (logs.length === 0) {
        console.log('\n📝 暂无日志记录');
        break;
      }

      console.log(`\n📝 最近 ${logs.length} 条日志:\n`);
      for (const log of logs) {
        const time = log.timestamp?.slice(11, 19) || '';
        const level = (log.level || '').toUpperCase().padEnd(5);
        const pipeline = log.pipeline || '';
        const phase = log.phase ? `[${log.phase}]` : '';
        console.log(`  ${time} ${level} ${pipeline} ${phase} ${log.message || ''}`);
      }
      break;
    }

    case 'validate': {
      const name = pipelineName || 'design-docs';
      console.log(`\n🔍 验证 ${name} 产出质量...`);
      // TODO: 独立的质量验证命令
      console.log('（验证功能已集成到 run 命令中）');
      break;
    }

    case 'list': {
      console.log('\n📦 已注册的预处理流水线:\n');
      for (const name of engine.listPipelines()) {
        console.log(`  - ${name}`);
      }
      break;
    }

    default:
      printHelp();
      break;
  }
}

function printReport(report) {
  console.log(`\n${report.status === 'success' ? '✅' : '❌'} 执行报告: ${report.pipeline}`);
  console.log(`   执行 ID: ${report.execution_id}`);
  console.log(`   耗时: ${(report.duration_ms / 1000).toFixed(1)}s`);
  console.log(`   状态: ${report.status}`);

  if (report.phases) {
    console.log('\n   阶段详情:');
    for (const [phase, data] of Object.entries(report.phases)) {
      const status = data.status === 'completed' ? '✅' : '❌';
      console.log(`     ${status} ${phase}`);
      if (data.data) {
        for (const [key, value] of Object.entries(data.data)) {
          if (typeof value === 'object' && value !== null) {
            console.log(`        ${key}: ${JSON.stringify(value)}`);
          } else {
            console.log(`        ${key}: ${value}`);
          }
        }
      }
    }
  }

  if (report.warnings && report.warnings.length > 0) {
    console.log(`\n   ⚠️  警告 (${report.warnings.length}):`);
    for (const w of report.warnings.slice(0, 5)) {
      console.log(`     - [${w.phase}] ${w.message}`);
    }
  }

  if (report.errors && report.errors.length > 0) {
    console.log(`\n   ❌ 错误 (${report.errors.length}):`);
    for (const e of report.errors.slice(0, 5)) {
      console.log(`     - [${e.phase}] ${e.message}`);
    }
  }

  console.log('');
}

function printHelp() {
  console.log(`
资料预处理框架 CLI

用法:
  node scripts/preprocess.js <command> [options]

命令:
  run <pipeline>              执行指定流水线
    --full                    强制全量处理（忽略增量）
    --dry-run                 预览模式（不写入文件）

  run-all                     执行所有已注册流水线
    --full                    强制全量
    --dry-run                 预览模式

  snapshots [pipeline]        列出执行快照

  rollback <pipeline>         回滚到指定快照
    --snapshot <id>           快照 ID

  logs [pipeline]             查看执行日志
    --last <N>                显示最近 N 条（默认 10）

  validate [pipeline]         运行质量验证

  list                        列出已注册流水线

示例:
  node scripts/preprocess.js run design-docs
  node scripts/preprocess.js run design-docs --full --dry-run
  node scripts/preprocess.js snapshots design-docs
  node scripts/preprocess.js logs --last 20
`);
}

main().catch(err => {
  console.error('未预期的错误:', err);
  process.exit(1);
});
