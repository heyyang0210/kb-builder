const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('knowledge center unified build contract', () => {
  const overviewDesignRoot = '.codex/知识中心建设平台/02-概要设计';
  const designRoot = '.codex/知识中心建设平台/03-详细设计';
  const buildScriptPath = 'tools/repository/build-knowledge-center.sh';
  const buildScript = read(buildScriptPath);
  const platformScript = read('knowledge-center.sh');
  const doctorScript = read('tools/deployment/knowledge-center-doctor.sh');
  const installScript = read('tools/deployment/install-knowledge-center.sh');
  const storageScript = read('apps/yashandb-storage/start.sh');
  const storageMain = read('apps/yashandb-storage/src/Main.java');
  const schemaMigrationManager = read('apps/yashandb-storage/src/migration/SchemaMigrationManager.java');
  const pingcodeViteConfig = read('apps/pingcode-web/vite.config.js');
  const yashandbEnvExample = read('config/yashandb/service.env.example');

  test('keeps exactly one repository build script', () => {
    const buildScripts = fs.readdirSync(path.join(repoRoot, 'tools/repository'))
      .filter((name) => /^(build|compile|package).+\.sh$/.test(name));

    expect(buildScripts).toEqual(['build-knowledge-center.sh']);
    expect(read('package.json')).toContain(`"build": "bash ${buildScriptPath}"`);
  });

  test('centralizes Vite and Java compilation in the build script', () => {
    expect(buildScript).toContain('npm run build');
    expect(buildScript).toContain('java_compile_args=(');
    expect(buildScript).toContain('apps/yashandb-storage/src/migration/SchemaMigrationManager.java');
    expect(buildScript).toContain('jdk.compiler/com.sun.tools.javac.Main');
    expect(platformScript).not.toContain('npm run build --');
    expect(storageScript).not.toMatch(/\bjavac\b/);
    expect(platformScript).toContain('sha256sum -c manifest.sha256');
  });

  test('版本化管理 YashanDB 结构迁移并兼容 006 历史名称', () => {
    const sqlDirectory = path.join(repoRoot, 'apps/yashandb-storage/sql');
    const migrationNames = fs.readdirSync(sqlDirectory)
      .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    const migration = read('apps/yashandb-storage/sql/006_add_manual_product_name.sql');
    const principalMigration = read('apps/yashandb-storage/sql/007_create_platform_principal.sql');
    const aliases = read('apps/yashandb-storage/sql/migration-aliases.properties');
    const storageRules = read('apps/yashandb-storage/AGENTS.md');

    expect(migrationNames).toContain('006_add_manual_product_name.sql');
    expect(migrationNames).not.toContain('006_manual_product_name.sql');
    expect(aliases).toContain('006_add_manual_product_name=006_manual_product_name');
    expect(crypto.createHash('sha256').update(migration).digest('hex'))
      .toBe('1a65c173e2f18a5a487d21105333496c7e193a99b754cc030ed07a06d23e21aa');
    expect(crypto.createHash('sha256').update(principalMigration).digest('hex'))
      .toBe('336a3600e291119e378c531fe6ce34a362a5a040c34ee980d88f67fe798a008e');
    expect(storageRules.trimEnd().split('\n')).toHaveLength(15);
    expect(storageRules).toContain('NNN_<action>_<object>.sql');
    expect(schemaMigrationManager).toContain('aliases.getOrDefault(version, List.of())');
    expect(storageMain).toContain('schemaMigrations.migrate(connection);');
    expect(storageMain).not.toContain('migrationAliases(');
    expect(storageMain).toContain('application.verifyMigrations();');
    expect(storageScript).toContain('Main "$@"');
    expect(buildScript).toContain('migration_source_dirty=false');
    expect(buildScript).toContain('migration-source.properties');
    expect(storageScript).toContain('拒绝执行迁移：SQL 必须来自已提交的 Git 版本');
    expect(storageScript).toContain('migration_source_actual_sha');
    expect(storageScript).toContain('migration_source_expected_sha');
    expect(yashandbEnvExample).not.toContain('YASDB_STORAGE_SQL_DIR=apps/yashandb-storage/sql');
    expect(yashandbEnvExample).toContain('YASDB_MIGRATION_CHECKSUM_POLICY=warn');
    expect(schemaMigrationManager).toContain('getOrDefault("YASDB_MIGRATION_CHECKSUM_POLICY", "warn")');
    expect(schemaMigrationManager).toContain('aliases.getOrDefault(version, List.of()), true');
    expect(schemaMigrationManager).toContain('执行 migrate 时仍会严格拒绝该冲突');
    const teamGroupMigration = read('apps/yashandb-storage/sql/012_decouple_team_groups.sql');
    expect(migrationNames).toContain('012_decouple_team_groups.sql');
    expect(read('apps/yashandb-storage/sql/011_team_groups.sql')).toContain('TECH_DOMAIN_ID BIGINT NOT NULL');
    expect(teamGroupMigration).toContain('ALTER TABLE KC_TECH_DOMAIN ADD TEAM_GROUP_ID BIGINT');
    expect(teamGroupMigration).toContain('UK_KC_TDOMAIN_GROUP UNIQUE (TEAM_GROUP_ID)');
    expect(teamGroupMigration).toContain('ALTER TABLE KC_TEAM_GROUP DROP COLUMN TECH_DOMAIN_ID');
    expect(storageMain).toContain('D.TEAM_GROUP_ID=G.TEAM_GROUP_ID');
    expect(storageMain).toContain('BUILD_TASK_ASSIGNEE_INVALID');
    expect(storageMain).toContain("M.MEMBER_ROLE='LEADER'");
    expect(storageMain).toContain('TEAM_GROUP_LEADER_DUPLICATED');
  });

  test('业务表按四个稳定业务边界共享主键序列', () => {
    const migration = read('apps/yashandb-storage/sql/009_consolidate_business_sequences.sql');
    const targetDdl = read('.codex/知识中心建设平台/03-详细设计/知识中心-手册与大纲管理-目标表结构.sql');

    for (const sequence of [
      'KC_MANUAL_SEQ',
      'KC_OUTLINE_SEQ',
      'KC_RESPONSIBILITY_SEQ'
    ]) {
      expect(migration).toContain(`CREATE SEQUENCE ${sequence}`);
      expect(targetDdl).toContain(`CREATE SEQUENCE ${sequence}`);
    }
    expect(migration).toContain('CREATE SEQUENCE KC_PRINCIPAL_SEQ');
    expect(migration).toContain('DROP SEQUENCE KC_BUSINESS_ID_SEQ');
    expect(migration).toContain('DROP SEQUENCE KC_MANUAL_ID_SEQ');
    expect(storageMain).not.toContain('KC_BUSINESS_ID_SEQ.NEXTVAL');
    expect(storageMain).toContain('KC_OUTLINE_SEQ');
    expect(storageMain).toContain('KC_RESPONSIBILITY_SEQ');
  });

  test('restricts artifacts to a repository-relative runtime build path', () => {
    expect(buildScript).toContain('[[ "$value" == runtime/build/* ]]');
    expect(buildScript).toContain('/*|[A-Za-z]:*|\\\\*|//*');
    expect(buildScript).toContain('"$segment" != ".."');
    expect(platformScript).toContain('KNOWLEDGE_CENTER_FRONTEND_ROOT="$BUILD_DIR/web/platform"');
    expect(platformScript).toContain('YASDB_STORAGE_CLASSES_DIR="$BUILD_DIR/java/classes"');
  });

  test('limits frontend build environment loading to public PingCode settings', () => {
    expect(pingcodeViteConfig).toContain("loadEnv(mode, process.cwd(), 'PINGCODE_WEB_')");
    expect(pingcodeViteConfig).not.toContain("loadEnv(mode, process.cwd(), '')");
    expect(buildScript).toContain('grep -R -I -F -l "$repo_root" "$stage_rel"');
    expect(buildScript).toContain('NODE_ENV=production NODE_OPTIONS="$pingcode_vite_node_options" npm run build');
    expect(buildScript).toContain('KNOWLEDGE_CENTER_VITE_NODE_OPTIONS');
    expect(buildScript).toContain('NODE_OPTIONS="$pingcode_vite_node_options"');
  });

  test('build fingerprint only scans existing repository inputs', () => {
    expect(buildScript).toContain('fingerprint_inputs=(');
    expect(buildScript).toContain('构建指纹输入不存在');
    expect(buildScript).not.toContain('packages/platform-config');

    const match = buildScript.match(/fingerprint_inputs=\(\n([\s\S]*?)\n\)/);
    expect(match).not.toBeNull();
    const trackedInputs = match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

    expect(trackedInputs.length).toBeGreaterThan(0);
    for (const relativePath of trackedInputs) {
      expect(fs.existsSync(path.join(repoRoot, relativePath))).toBe(true);
    }
  });

  test('validates restart inputs and only force-stops owned repository processes', () => {
    expect(() => childProcess.execFileSync('bash', ['-n', path.join(repoRoot, 'knowledge-center.sh')], { stdio: 'pipe' })).not.toThrow();
    expect(platformScript).toContain('validate_port_configuration');
    expect(platformScript).toContain('validate_positive_integer KNOWLEDGE_CENTER_STOP_TIMEOUT');
    expect(platformScript).toContain('对已确认的本仓库进程执行强制终止');
    expect(platformScript).toContain('已停止 $service，但端口 $port 仍被占用');
    expect(platformScript).toContain('知识中心操作失败。');
    expect(platformScript).toContain('失败阶段：$FAILURE_COMPONENT');
    expect(platformScript).toContain('数据库迁移完整性校验失败');
    expect(platformScript).toContain('启动告警：$name');
    expect(platformScript).toContain('reason=http-health-check-failed');
    expect(platformScript).toContain('PID 记录指向非本仓库进程');
    expect(platformScript).toContain('当前配置无法安全计算组件状态');
    expect(platformScript).toContain('validate_environment || return 1');
    expect(platformScript).toContain('build_platform || return 1');
    expect(platformScript).toContain('start_platform || return 1');
    expect(schemaMigrationManager).toContain('（数据库=" + recordedChecksum + "，当前文件=" + checksum + "）');
  });

  test('跨环境部署使用完整外部 URL 并分离诊断与安装', () => {
    const envExample = read('config/knowledge-center/.env.example');
    const frontendServer = read('apps/knowledge-center-web/frontend-server.js');

    expect(platformScript).toContain('KNOWLEDGE_CENTER_PUBLIC_BASE_URL');
    expect(platformScript).not.toMatch(/https?:\/\/(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/);
    expect(platformScript).toContain('PUBLIC_SERVICE_URL="$PUBLIC_APP_URL"');
    expect(platformScript).toContain('PUBLIC_OAUTH_REDIRECT_URI="${PUBLIC_BASE_URL:+$PUBLIC_BASE_URL/knowledge-center/api/gitlab/oauth/callback}"');
    expect(platformScript).toContain('run_doctor "$DOCTOR_FORMAT"');
    expect(platformScript).toContain('install-knowledge-center.sh --apply');
    expect(platformScript).toContain('KNOWLEDGE_CENTER_VERIFY_PUBLIC_URL');
    expect(platformScript).toContain('SERVICE_ENV_FILE="$YASDB_CONFIG_DIR/service.env"');
    expect(platformScript).toContain('KNOWLEDGE_CENTER_ENVIRONMENT="$KNOWLEDGE_CENTER_ENVIRONMENT"');
    expect(platformScript).toContain('KNOWLEDGE_CENTER_TEST_RUN_ID="${KNOWLEDGE_CENTER_TEST_RUN_ID:-}"');
    expect(platformScript).toContain('PLAYWRIGHT_BROWSERS_PATH');
    expect(doctorScript).toContain('doctor_print_json');
    expect(doctorScript).toContain('"$STORAGE_DIR/start.sh" probe');
    expect(doctorScript).toContain('"$STORAGE_DIR/start.sh" verify');
    expect(installScript).toContain('--offline-bundle');
    expect(installScript).toContain('sha256sum -c manifest.sha256');
    expect(installScript).toContain('python-wheels');
    expect(installScript).toContain('playwright-browsers');
    expect(installScript).toContain('-m playwright install chromium');
    expect(installScript).toContain('-m playwright install --with-deps chromium');
    expect(installScript).toContain('rpm:browser)');
    expect(installScript).toContain('p.chromium.launch(headless=True)');
    expect(frontendServer).toContain('KNOWLEDGE_CENTER_PUBLIC_BASE_URL');
    expect(envExample).toContain('KNOWLEDGE_CENTER_PUBLIC_BASE_URL=http://127.0.0.1:13510');
    expect(envExample).toContain('KNOWLEDGE_CENTER_FRONTEND_PORT=13510');
    expect(envExample).not.toMatch(/^PORT=/m);
    expect(envExample).not.toMatch(/^DOCUMENT_API_PORT=/m);
    expect(envExample).not.toMatch(/^PINGCODE_API_PORT=/m);
    expect(envExample).not.toMatch(/^PINGCODE_WEB_HOST=/m);
  });

  test('doctor 输出可解析 JSON 且不泄漏数据库密码', () => {
    const result = childProcess.spawnSync(path.join(repoRoot, 'knowledge-center.sh'), ['doctor', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        KNOWLEDGE_CENTER_ENV: 'development',
        KNOWLEDGE_CENTER_PUBLIC_BASE_URL: 'http://127.0.0.1:13510',
        KNOWLEDGE_CENTER_DOCTOR_SKIP_DATABASE: '1',
      },
    });
    const report = JSON.parse(result.stdout);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.some(check => check.code === 'public-url' && check.status === 'PASS')).toBe(true);
    const databasePassword = process.env.YASDB_PASSWORD || '';
    if (databasePassword) expect(result.stdout).not.toContain(databasePassword);
  });

  test('doctor 保留显式测试环境标识并遵循自定义数据库配置目录', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kc-doctor-env-contract-'));
    try {
      const result = childProcess.spawnSync(path.join(repoRoot, 'knowledge-center.sh'), ['doctor', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          KNOWLEDGE_CENTER_ENV: '',
          KNOWLEDGE_CENTER_ENVIRONMENT: 'test',
          KNOWLEDGE_CENTER_PUBLIC_BASE_URL: 'http://127.0.0.1:13510',
          KNOWLEDGE_CENTER_DOCTOR_SKIP_DATABASE: '1',
          YASDB_CONFIG_DIR: temporaryRoot,
        },
      });
      const report = JSON.parse(result.stdout);
      expect(report.environment).toBe('test');
      const databaseCheck = report.checks.find(check => check.code === 'database-env');
      expect(databaseCheck.current).toBe('service.env 不存在');
      expect(databaseCheck.command).toContain(path.join(temporaryRoot, 'service.env'));
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('安装器为 RPM 和 DEB 系统生成不同基础包命令', () => {
    const temporaryRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'kc-install-contract-'));
    try {
      const kylin = path.join(temporaryRoot, 'kylin-os-release');
      const debian = path.join(temporaryRoot, 'debian-os-release');
      fs.writeFileSync(kylin, 'ID=kylin\nID_LIKE=rhel\n');
      fs.writeFileSync(debian, 'ID=debian\nID_LIKE=debian\n');
      const run = osRelease => childProcess.execFileSync('bash', [
        path.join(repoRoot, 'tools/deployment/install-knowledge-center.sh'), '--check', '--component', 'base'
      ], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: { ...process.env, KNOWLEDGE_CENTER_OS_RELEASE_FILE: osRelease },
      });
      expect(run(kylin)).toMatch(/(dnf|yum) install -y/);
      expect(run(debian)).toContain('apt-get install -y');
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });

  test('知识中心管理平台设计只归档到建设平台设计目录', () => {
    const migrations = [
      ['docs/agent-runner/modules/platform-foundation/overview/document-governance-overview-design.md', overviewDesignRoot, '知识中心-平台-文档治理与周期对账-概要设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/overview/知识中心平台-业务域与目标架构设计.md', overviewDesignRoot, '知识中心-平台-业务域与目标架构-概要设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/overview/知识中心建设平台通用化总体架构设计.md', overviewDesignRoot, '知识中心-平台-通用化目标架构-概要设计文档.md'],
      ['docs/agent-runner/modules/outline-management/overview/outline-management-overview-design.md', overviewDesignRoot, '知识中心-大纲管理-工作台与治理-概要设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/enterprise-profile-v1配置与运行上下文设计.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/platform-kernel-module-boundary-design.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/reconcile-docs-skill-design.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/template-management-database-design.md', designRoot, '知识中心-模板管理-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/yashandb-storage-and-migration-design.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/yashandb-storage-table-inventory.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/手册与大纲关系模型实施设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/知识中心看板-表结构说明.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/29-YashanDB知识库大纲上传内容与格式规格.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/39-管理员手册大纲兼容阶段一-基线与规范副本设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/40-管理员手册大纲兼容阶段二-统一解析与结构化诊断设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/41-管理员手册大纲兼容阶段三-安全上传与真实API验收设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/42-管理员手册大纲兼容阶段四-预检差异确认与正式上传设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/43-管理员手册大纲兼容阶段五-评分建议与持续治理设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/44-知识中心大纲统一解析展示与管理员增删权限设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/outline-management/development/45-大纲三阶段责任分工与发布任务设计.md', designRoot, '知识中心-大纲管理-详细设计文档.md'],
      ['docs/agent-runner/modules/platform-foundation/development/knowledge-center-reproducible-build-design.md', designRoot, '知识中心-平台-详细设计文档.md'],
      ['docs/agent-runner/overview/service-startup-and-restart-design.md', designRoot, '知识中心-平台-详细设计文档.md'],
    ];
    const migrationMap = read('docs/agent-runner/MIGRATION-MAP.md');

    expect(migrations).toHaveLength(22);
    for (const [legacyPath, targetRoot, filename] of migrations) {
      expect(fs.existsSync(path.join(repoRoot, targetRoot, filename))).toBe(true);
      expect(fs.existsSync(path.join(repoRoot, legacyPath))).toBe(false);
      expect(read(`${targetRoot}/README.md`)).toContain(`](./${filename})`);
      expect(migrationMap).toContain(`\`${legacyPath}\``);
      expect(migrationMap).toContain(`\`${targetRoot}/${filename}\``);
    }
    expect(fs.existsSync(path.join(repoRoot, 'docs/agent-runner/modules/platform-foundation/overview/知识中心管理平台目标模式重构执行提示词.md'))).toBe(true);
  });
});
