#!/usr/bin/env python3
"""Collect JaCoCo line and branch coverage for all storage product classes."""

import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/yashandb-storage/src"
FIXTURES = ROOT / "tests/unit/agent-runner/fixtures"
DEFAULT_TOOLS = ROOT / "runtime/test-results/quality-fix-coverage/tools"
TASK_MIGRATION_SCENARIOS = ("copy", "activate", "copy-existing", "copy-invalid-legacy",
                            "copy-duplicate", "copy-bad-readback", "copy-wrong-target", "copy-no-backup",
                            "activate-bad-backup",
                            "activate-not-verified", "activate-changed", "activate-duplicate",
                            "activate-bad-row", "activate-missing-row", "activate-no-repo",
                            "activate-wrong-target", "activate-no-backup",
                            "activate-symlink")


def run(command, *, env=None, timeout=90):
    result = subprocess.run(command, cwd=ROOT, env=env, timeout=timeout, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    if result.returncode:
        raise RuntimeError(f"命令失败（{result.returncode}）：{' '.join(map(str, command))}\n{result.stdout}")
    return result.stdout


def count(counter):
    return {"covered": int(counter.get("covered", "0")),
            "total": int(counter.get("covered", "0")) + int(counter.get("missed", "0"))}


def source_manifest(checks):
    paths = {*SOURCE.rglob("*.java"), Path(__file__).resolve(),
             *(FIXTURES / f"{name}.java" for name in checks)}
    return {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(paths)}


def main():
    output = Path(os.environ.get("KC_JAVA_COVERAGE_OUTPUT", ROOT / "runtime/coverage-goal/java-full")).resolve()
    tools = Path(os.environ.get("KC_JACOCO_TOOLS", DEFAULT_TOOLS)).resolve()
    agent, cli = tools / "agent.jar", tools / "cli.jar"
    if not agent.is_file() or not cli.is_file():
        raise RuntimeError(f"缺少 JaCoCo agent/CLI：{tools}；请提供 KC_JACOCO_TOOLS")
    product, fixture = output / "product-classes", output / "fixture-classes"
    product.mkdir(parents=True, exist_ok=True)
    fixture.mkdir(parents=True, exist_ok=True)
    sources = sorted(SOURCE.rglob("*.java"))
    if not sources:
        raise RuntimeError("没有 Java 产品源码")
    jdbc = ROOT / "apps/yashandb-storage/lib/yashandb-jdbc.jar"
    checks = ["DraftReadProjectionCheck", "QualityResultLimitCheck", "QualityExecuteHttpCheck", "StorageHttpInputCheck", "StorageRecordHttpCheck", "StorageManualSnapshotHttpCheck", "StoragePrincipalHttpCheck", "StorageAuthHttpCheck", "StorageGitLabHttpCheck", "StorageDomainReadHttpCheck", "StorageMainProbeCheck", "StorageMainCommandCheck",
              "JdbcPoolReuseCheck", "ProductionReferenceChangesCheck", "RecordClobReadCheck",
              "OutlineStorageContractCheck", "StorageBootstrapContractCheck", "MigrationSqlParserCheck", "MigrationExecutionCheck",
              "StorageSchemaDaoCheck", "HandbookProjectionCheck", "PrincipalRepositoryCheck",
              "PlatformAuthRepositoryCheck", "PlatformGitLabRepositoryCheck"]
    checks.extend(["StorageDocumentTaskHttpCheck", "StoragePingcodeTaskHttpCheck", "StorageDocumentTaskMigrationCommandCheck",
                   "TaskNumberCheck", "DocumentTaskStatusCheck", "DocumentTaskHistoricalReviewCheck",
                   "PingcodeTaskPayloadCheck", "PingcodeTaskSourceUrlCheck"])
    before = source_manifest(checks)
    (output / "source-manifest-before.json").write_text(json.dumps(before, ensure_ascii=False, indent=2), encoding="utf-8")
    run(["javac", "-encoding", "UTF-8", "-cp", str(jdbc), "-d", str(product), *map(str, sources)])
    run(["javac", "-encoding", "UTF-8", "-cp", f"{product}:{jdbc}", "-d", str(fixture),
         *[str(FIXTURES / f"{name}.java") for name in checks]])
    execution = output / "java.exec"
    execution.unlink(missing_ok=True)
    classpath = f"{fixture}:{product}:{jdbc}"
    env = {**os.environ, "YASDB_JDBC_URL": "jdbc:fixture:business", "YASDB_USERNAME": "fixture",
           "YASDB_PASSWORD": "fixture", "YASDB_QUALITY_JDBC_URL": "jdbc:fixture:quality",
           "YASDB_QUALITY_USERNAME": "reader", "YASDB_QUALITY_PASSWORD": "secret", "YASDB_QUALITY_MAX_ROWS": "2"}
    outline_content = run(["node", "-e", "const path = require('node:path'); "
                           "const { rules } = require('./packages/agent-runner-core/lib/outline-path-template'); "
                           "const { parseXlsxOutlineFile } = require('./packages/agent-runner-core/routes/outline-management'); "
                           "process.stdout.write(JSON.stringify(parseXlsxOutlineFile(path.resolve(rules.sampleDownloadPath), 'SQL参考手册')));"])
    json.loads(outline_content)
    outline_fixture = output / "outline-content.json"
    outline_fixture.write_text(outline_content, encoding="utf-8")
    for check in ("DraftReadProjectionCheck", "QualityResultLimitCheck", "JdbcPoolReuseCheck",
                  "ProductionReferenceChangesCheck", "RecordClobReadCheck", "StorageSchemaDaoCheck", "StorageHttpInputCheck", "StorageRecordHttpCheck", "StorageManualSnapshotHttpCheck", "StoragePrincipalHttpCheck", "StorageAuthHttpCheck", "StorageGitLabHttpCheck", "StorageDomainReadHttpCheck",
                  "HandbookProjectionCheck", "PrincipalRepositoryCheck", "PlatformAuthRepositoryCheck", "StorageBootstrapContractCheck",
                  "StorageDocumentTaskHttpCheck", "StoragePingcodeTaskHttpCheck", "TaskNumberCheck", "DocumentTaskStatusCheck", "DocumentTaskHistoricalReviewCheck",
                  "PingcodeTaskPayloadCheck", "PingcodeTaskSourceUrlCheck",
                  "PlatformGitLabRepositoryCheck", "StorageMainProbeCheck"):
        check_env = {**env, "YASDB_DIRECTORY_CACHE_TTL_MS": "60000"} if check == "StorageDomainReadHttpCheck" else env
        if check == "StorageManualSnapshotHttpCheck":
            check_env = {**check_env, "PERF_TRACE": "1"}
        run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath, check], env=check_env)
    for result_mode in ("empty", "wrong-value"):
        run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
             "StorageMainProbeCheck", result_mode], env=env)
    with socket.socket() as port_probe:
        port_probe.bind(("127.0.0.1", 0))
        server_port = port_probe.getsockname()[1]
    server_env = {**env, "YASDB_STORAGE_HOST": "127.0.0.1", "YASDB_STORAGE_PORT": str(server_port),
                  "YASDB_STORAGE_POOL_MIN": "0"}
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "StorageBootstrapContractCheck", "server-http"], env=server_env)
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "OutlineStorageContractCheck", str(outline_fixture)], env=env)
    requirement_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                           "StoragePingcodeTaskHttpCheck", "requirement"], env=env)
    if "PASS: PingCode requirement IR/SR real HTTP lifecycle" not in requirement_log:
        raise RuntimeError(f"PingCode 需求关联验收未完成：{requirement_log}")
    boundary_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                        "StoragePingcodeTaskHttpCheck", "boundary"], env=env)
    if "PASS: PingCode source and page boundary real HTTP lifecycle" not in boundary_log:
        raise RuntimeError(f"PingCode 分页边界验收未完成：{boundary_log}")
    primary_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                       "StoragePingcodeTaskHttpCheck", "primary-decision"], env=env)
    if "PASS: PingCode multiple-source decision real HTTP boundary" not in primary_log:
        raise RuntimeError(f"PingCode 多来源决策验收未完成：{primary_log}")
    crud_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                    "StoragePingcodeTaskHttpCheck", "crud"], env=env)
    if "PASS: PingCode source CRUD real HTTP lifecycle" not in crud_log:
        raise RuntimeError(f"PingCode 来源 CRUD 验收未完成：{crud_log}")
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationSqlParserCheck"], env=env)
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationExecutionCheck", str(output / "migration-fixture")], env=env)
    command_scenarios = ("migrate-no-seed", "migrate-index-equivalent", "migrate-index-conflict", "migrate-seed", "migrate-empty-seed", "migrate-invalid-json",
                         "migrate-invalid-utf8", "verify", "verify-pending", "serve")
    for scenario in command_scenarios:
        command_directory = output / "startup-commands" / scenario
        with socket.socket() as port_probe:
            port_probe.bind(("127.0.0.1", 0))
            command_port = port_probe.getsockname()[1]
        command_env = {**env, "YASDB_STORAGE_SQL_DIR": str(command_directory),
                       "YASDB_TECH_DOMAINS_SEED_FILE": str(command_directory / "tech-domains.seed.json"),
                       "YASDB_STORAGE_HOST": "127.0.0.1", "YASDB_STORAGE_PORT": str(command_port),
                       "YASDB_STORAGE_POOL_MIN": "0", "PERF_TRACE": "1"}
        command_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                          "StorageMainCommandCheck", scenario], env=command_env)
        if f"PASS: public startup command {scenario}" not in command_log:
            raise RuntimeError(f"启动命令验证未完成：{scenario}\n{command_log}")
        if scenario == "migrate-seed" and "数据库迁移已完成" not in command_log:
            raise RuntimeError("migrate未输出完成信息")
        if scenario == "verify" and '\"migrations\":\"verified\"' not in command_log:
            raise RuntimeError("verify未输出校验成功JSON")
        (command_directory / "command.log").write_text(command_log, encoding="utf-8")
    for scenario in TASK_MIGRATION_SCENARIOS:
        command_directory = output / "task-migration" / scenario
        command_env = {**env, "YASDB_STORAGE_SQL_DIR": str(command_directory / "sql"),
                       "KC_DOCUMENT_TASK_BACKUP_PATH": "" if scenario.endswith("no-backup") else str(command_directory / "backup.json"),
                       "KNOWLEDGE_CENTER_REPO_ROOT": "" if scenario == "activate-no-repo" else str(ROOT),
                       "YASDB_STORAGE_TARGET_CLASS": "shared" if scenario.endswith("wrong-target") else "personal"}
        command_log = run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
                           "StorageDocumentTaskMigrationCommandCheck", scenario], env=command_env)
        if f"PASS: public task migration command {scenario}" not in command_log:
            raise RuntimeError(f"逐任务迁移命令验证未完成：{scenario}\n{command_log}")
        (command_directory / "command.log").write_text(command_log, encoding="utf-8")
    invalid_policy_env = {**env, "YASDB_MIGRATION_CHECKSUM_POLICY": "invalid"}
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationExecutionCheck", str(output / "migration-invalid-policy"), "invalid-policy"],
        env=invalid_policy_env)
    strict_policy_env = {**env, "YASDB_MIGRATION_CHECKSUM_POLICY": "strict"}
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationExecutionCheck", str(output / "migration-strict-policy"), "strict-policy"],
        env=strict_policy_env)
    for scenario in ("missing-url", "missing-user", "missing-password", "business-url", "configured"):
        scenario_env = dict(env)
        if scenario == "missing-url": scenario_env["YASDB_QUALITY_JDBC_URL"] = ""
        if scenario == "missing-user": scenario_env["YASDB_QUALITY_USERNAME"] = ""
        if scenario == "missing-password": scenario_env["YASDB_QUALITY_PASSWORD"] = ""
        if scenario == "business-url": scenario_env["YASDB_QUALITY_JDBC_URL"] = env["YASDB_JDBC_URL"]
        run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
             "QualityExecuteHttpCheck", scenario], env=scenario_env)
    xml = output / "java.xml"
    run(["java", "-jar", str(cli), "report", str(execution), "--classfiles", str(product),
         "--sourcefiles", str(SOURCE), "--xml", str(xml), "--html", str(output / "html")])
    report = ET.parse(xml).getroot()
    actual = {item.get("name") for package in report.findall("package") for item in package.findall("sourcefile")}
    expected = {source.name for source in sources}
    if actual != expected:
        raise RuntimeError(f"Java 报告源文件不完整：缺少 {sorted(expected - actual)}，多出 {sorted(actual - expected)}")
    counters = {counter.get("type"): count(counter) for counter in report.findall("counter")}
    result = {"sourceFiles": len(sources), "lines": counters["LINE"], "branches": counters["BRANCH"],
              "checks": [*[f"StorageMainCommandCheck:{scenario}" for scenario in command_scenarios], "DraftReadProjectionCheck", "QualityResultLimitCheck", "StorageHttpInputCheck", "StorageRecordHttpCheck", "StorageManualSnapshotHttpCheck", "StoragePrincipalHttpCheck", "StorageAuthHttpCheck", "StorageGitLabHttpCheck", "StorageDomainReadHttpCheck", "StorageMainProbeCheck", "StorageMainProbeCheck:empty", "StorageMainProbeCheck:wrong-value", "JdbcPoolReuseCheck",
                         "ProductionReferenceChangesCheck", "RecordClobReadCheck", "OutlineStorageContractCheck",
                         "MigrationSqlParserCheck", "MigrationExecutionCheck", "MigrationExecutionCheck:invalid-policy",
                         "MigrationExecutionCheck:strict-policy", "StorageSchemaDaoCheck",
                         "HandbookProjectionCheck", "PrincipalRepositoryCheck", "PlatformAuthRepositoryCheck",
                         "PlatformGitLabRepositoryCheck", "StorageBootstrapContractCheck",
                         "StorageBootstrapContractCheck:server-http",
                         "StorageDocumentTaskHttpCheck", "StoragePingcodeTaskHttpCheck", "StoragePingcodeTaskHttpCheck:requirement", "StoragePingcodeTaskHttpCheck:boundary", "StoragePingcodeTaskHttpCheck:primary-decision", "StoragePingcodeTaskHttpCheck:crud", "TaskNumberCheck", "DocumentTaskStatusCheck", "DocumentTaskHistoricalReviewCheck",
                         *[f"StorageDocumentTaskMigrationCommandCheck:{scenario}" for scenario in TASK_MIGRATION_SCENARIOS],
                         "PingcodeTaskPayloadCheck", "PingcodeTaskSourceUrlCheck",
                         *[f"QualityExecuteHttpCheck:{scenario}" for scenario in
                           ("missing-url", "missing-user", "missing-password", "business-url", "configured")]]}
    (output / "coverage-summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    after = source_manifest(checks)
    changed = sorted(path for path in before.keys() | after.keys() if before.get(path) != after.get(path))
    (output / "source-manifest-after.json").write_text(json.dumps(after, ensure_ascii=False, indent=2), encoding="utf-8")
    (output / "source-stability.json").write_text(json.dumps({"stable": not changed, "changedFiles": changed}, ensure_ascii=False, indent=2), encoding="utf-8")
    if changed:
        raise RuntimeError(f"Java采集期间源码发生变化，报告仅供诊断：{changed}")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired, ET.ParseError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
