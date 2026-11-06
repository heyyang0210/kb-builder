#!/usr/bin/env python3
"""Collect JaCoCo line and branch coverage for all storage product classes."""

import json
import os
from pathlib import Path
import subprocess
import sys
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/yashandb-storage/src"
FIXTURES = ROOT / "tests/unit/agent-runner/fixtures"
DEFAULT_TOOLS = ROOT / "runtime/test-results/quality-fix-coverage/tools"


def run(command, *, env=None, timeout=90):
    result = subprocess.run(command, cwd=ROOT, env=env, timeout=timeout, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, check=False)
    if result.returncode:
        raise RuntimeError(f"命令失败（{result.returncode}）：{' '.join(map(str, command))}\n{result.stdout}")
    return result.stdout


def count(counter):
    return {"covered": int(counter.get("covered", "0")),
            "total": int(counter.get("covered", "0")) + int(counter.get("missed", "0"))}


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
    run(["javac", "-encoding", "UTF-8", "-cp", str(jdbc), "-d", str(product), *map(str, sources)])
    checks = ["DraftReadProjectionCheck", "QualityResultLimitCheck", "QualityExecuteHttpCheck", "StorageHttpInputCheck", "StorageRecordHttpCheck", "StorageManualSnapshotHttpCheck", "StoragePrincipalHttpCheck", "StorageAuthHttpCheck", "StorageGitLabHttpCheck", "StorageDomainReadHttpCheck",
              "JdbcPoolReuseCheck", "ProductionReferenceChangesCheck", "RecordClobReadCheck",
              "OutlineStorageContractCheck", "StorageBootstrapContractCheck", "MigrationSqlParserCheck", "MigrationExecutionCheck",
              "StorageSchemaDaoCheck", "HandbookProjectionCheck", "PrincipalRepositoryCheck",
              "PlatformAuthRepositoryCheck", "PlatformGitLabRepositoryCheck"]
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
                  "PlatformGitLabRepositoryCheck"):
        run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath, check], env=env)
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "OutlineStorageContractCheck", str(outline_fixture)], env=env)
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationSqlParserCheck"], env=env)
    run(["java", f"-javaagent:{agent}=destfile={execution},append=true", "-cp", classpath,
         "migration.MigrationExecutionCheck", str(output / "migration-fixture")], env=env)
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
              "checks": ["DraftReadProjectionCheck", "QualityResultLimitCheck", "StorageHttpInputCheck", "StorageRecordHttpCheck", "StorageManualSnapshotHttpCheck", "StoragePrincipalHttpCheck", "StorageAuthHttpCheck", "StorageGitLabHttpCheck", "StorageDomainReadHttpCheck", "JdbcPoolReuseCheck",
                         "ProductionReferenceChangesCheck", "RecordClobReadCheck", "OutlineStorageContractCheck",
                         "MigrationSqlParserCheck", "MigrationExecutionCheck", "StorageSchemaDaoCheck",
                         "HandbookProjectionCheck", "PrincipalRepositoryCheck", "PlatformAuthRepositoryCheck",
                         "PlatformGitLabRepositoryCheck", "StorageBootstrapContractCheck",
                         *[f"QualityExecuteHttpCheck:{scenario}" for scenario in
                           ("missing-url", "missing-user", "missing-password", "business-url", "configured")]]}
    (output / "coverage-summary.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.TimeoutExpired, ET.ParseError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
