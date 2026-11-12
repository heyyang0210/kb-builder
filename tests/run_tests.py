#!/usr/bin/env python3
"""YashanDB 知识库仓库统一测试入口。

用例按文件命名自动归类，再交给 Jest、Node、unittest、pytest、Python
或 Playwright 执行，以便保留各 runner 逐条用例的成功/失败输出。
"""

from __future__ import annotations

import argparse
import ast
from concurrent.futures import ThreadPoolExecutor
import fcntl
import html
import hashlib
import json
import os
import re
import shlex
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
NODE_TEST_ROOT = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner"
PYTHON_TEST_ROOT = REPOSITORY_ROOT / "tests" / "unit"
E2E_TEST_ROOT = REPOSITORY_ROOT / "tests" / "e2e" / "agent-runner"
JEST_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "jest.config.js"
JEST_COVERAGE_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "jest.coverage.config.js"
COVERAGE_TARGETS = REPOSITORY_ROOT / "config" / "knowledge-center" / "coverage-targets.json"
PLAYWRIGHT_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "playwright.config.js"
TEST_REPORT_ROOT = REPOSITORY_ROOT / "runtime" / "test-reports"
TEST_RESULT_ROOT = REPOSITORY_ROOT / "runtime" / "test-results"
TEST_DATABASE_CONFIG_DIR = REPOSITORY_ROOT / "runtime" / "test-config" / "yashandb"
KNOWLEDGE_CENTER_SCRIPT = REPOSITORY_ROOT / "knowledge-center.sh"
KNOWLEDGE_CENTER_BUILD_SCRIPT = REPOSITORY_ROOT / "tools" / "repository" / "build-knowledge-center.sh"
YASHANDB_STORAGE_SCRIPT = REPOSITORY_ROOT / "apps" / "yashandb-storage" / "start.sh"
E2E_DATABASE_SYNC_SCRIPT = REPOSITORY_ROOT / "tools" / "repository" / "sync-e2e-yashandb-schema.sh"
E2E_DATABASE_LOCK_FILE = REPOSITORY_ROOT / "runtime" / "test-results" / "database-sync" / "test-hy.lock"
KNOWLEDGE_CENTER_BASE_URL = "http://127.0.0.1:13510"
KNOWLEDGE_CENTER_HEALTH_URL = KNOWLEDGE_CENTER_BASE_URL + "/knowledge-center/api/auth/config"

SEMANTIC_SUITES = ("gate", "unit", "contract", "integration", "system", "e2e")
FULL_SUITES = SEMANTIC_SUITES
FRAMEWORKS = ("jest", "node-test", "node-script", "unittest", "pytest", "python-script", "playwright")

# 冒烟集是有意维护的最小关键路径：配置、前端安全门禁和 Python 数据库配置。
SMOKE_FILES = (
    "tests/unit/agent-runner/config-validator.test.js",
    "tests/unit/agent-runner/知识中心管理平台门禁/markdown-renderer.gate.test.js",
    "tests/unit/pingcode/test_yashandb_config.py",
)


@dataclass(frozen=True)
class TestTask:
    suite: str
    framework: str
    label: str
    files: tuple[Path, ...]
    resource: str = ""


def task_resource(task: TestTask) -> str:
    """Return the resource channel used to schedule a task.

    The default is deliberately conservative: unknown tests must not run
    concurrently with tests that may mutate shared state.
    """
    if task.resource:
        return task.resource
    if task.framework == "playwright":
        return "performance" if task.suite == "gate" else "database-write"
    if task.suite == "system":
        return "service-read"
    if task.suite == "integration":
        return "shared-state"
    if task.framework in {"node-script", "python-script"}:
        return "shared-state"
    if task.framework in {"unittest", "pytest"} and any(
        token in path.name.lower()
        for path in task.files
        for token in ("libreoffice", "vision", "upload", "integration", "concurrency")
    ):
        return "isolated-io"
    if task.framework in {"jest", "node-test", "unittest", "pytest"}:
        return "isolated-cpu"
    return "shared-state"


@dataclass(frozen=True)
class TaskResult:
    suite: str
    label: str
    framework: str
    status: str
    duration_seconds: float
    return_code: int
    file_count: int
    failed_tests: tuple[str, ...] = ()
    command: str = ""
    test_total: int | None = None
    test_passed: int | None = None
    test_failed: int | None = None
    test_skipped: int | None = None
    log_file: str = ""
    cases: tuple[dict[str, Any], ...] = ()


@dataclass(frozen=True)
class RunContext:
    command: str
    run_id: str
    run_dir: Path
    details_dir: Path
    tasks_dir: Path
    artifact_dir: Path
    formal: bool


@dataclass(frozen=True)
class CoverageSummary:
    status: str
    scope: str
    metrics: dict[str, float]
    lowest_files: tuple[tuple[str, float], ...] = ()
    diagnostic: str = ""
    source_files: int = 0
    counts: dict[str, dict[str, int]] | None = None
    runtime_metrics: dict[str, dict[str, Any]] | None = None


@dataclass(frozen=True)
class KnowledgeCenterLease:
    owner: str
    base_url: str
    health_url: str
    environment: dict[str, str]
    state_dir: Path
    process_identities: dict[str, tuple[int, str]]
    database_lock: Any


def relative(path: Path) -> str:
    return path.relative_to(REPOSITORY_ROOT).as_posix()


def create_run_context(
    command: str,
    now: datetime | None = None,
    formal_override: bool | None = None,
) -> RunContext:
    generated_at = now or datetime.now().astimezone()
    canonical_command = "full" if command == "all" else command
    run_id = f"{generated_at:%Y%m%d-%H%M%S-%f}-{canonical_command}"
    formal = canonical_command in {"full", "gate"} if formal_override is None else formal_override
    root = TEST_REPORT_ROOT / f"{generated_at:%Y-%m-%d}" if formal else TEST_RESULT_ROOT / canonical_command
    run_dir = root / run_id
    details_dir = run_dir / "details"
    tasks_dir = details_dir / "tasks"
    artifact_dir = details_dir / "artifacts"
    tasks_dir.mkdir(parents=True, exist_ok=False)
    return RunContext(canonical_command, run_id, run_dir, details_dir, tasks_dir, artifact_dir, formal)


def task_slug(index: int, task: TestTask) -> str:
    safe_label = re.sub(r"[^a-z0-9]+", "-", f"{task.suite}-{task.framework}".lower()).strip("-")
    return f"{index:03d}-{safe_label or 'task'}"


def classify_name(path: Path, framework: str) -> str:
    """按稳定命名约定归类；新增规范命名的用例无需修改入口。"""
    name = path.name.lower()
    if name in {"demo_test.py", "test_api_client.py"}:
        return "integration"
    if ".gate." in name:
        return "gate"
    if framework == "playwright":
        return "e2e"
    if "contract" in name or "compatibility" in name:
        return "contract"
    if "integration" in name:
        return "integration"
    if "system" in name or "performance" in name or (framework == "jest" and "e2e" in name):
        return "system"
    return "unit"


def classify_node_runner(path: Path) -> str:
    """Jest 文件包含用例声明，否则按独立 Node 脚本执行。"""
    source = path.read_text(encoding="utf-8")
    # Bridges may mock node:test while still depending on the Jest runtime.
    if re.search(r"\bjest\s*\.", source):
        return "jest"
    if "node:test" in source or "mock.method" in source:
        return "node-test"
    jest_call = re.compile(r"(?:^|[^\w$.])(?:describe|it|test)(?:\.(?:each|only|skip))?\s*\(", re.MULTILINE)
    return "jest" if jest_call.search(source) else "node-script"


def classify_python_runner(path: Path) -> str:
    """Distinguish unittest, pytest, and legacy executable test scripts."""
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    imports_pytest = any(
        (isinstance(node, ast.Import) and any(alias.name == "pytest" for alias in node.names))
        or (isinstance(node, ast.ImportFrom) and node.module == "pytest")
        for node in tree.body
    )
    has_unittest_case = any(
        isinstance(node, ast.ClassDef)
        and any(
            (isinstance(base, ast.Attribute) and base.attr.endswith("TestCase"))
            or (isinstance(base, ast.Name) and base.id.endswith("TestCase"))
            for base in node.bases
        )
        for node in tree.body
    )
    has_main = any(
        isinstance(node, ast.If)
        and isinstance(node.test, ast.Compare)
        and any(isinstance(value, ast.Constant) and value.value == "__main__" for value in node.test.comparators)
        for node in tree.body
    )
    if has_unittest_case:
        return "unittest"
    if imports_pytest or not has_main:
        return "pytest"
    return "python-script"


def discover_test_files() -> dict[str, dict[str, list[Path]]]:
    discovered = {
        suite: {framework: [] for framework in FRAMEWORKS}
        for suite in SEMANTIC_SUITES
    }

    for path in sorted(NODE_TEST_ROOT.rglob("*.test.js")):
        framework = classify_node_runner(path)
        discovered[classify_name(path, framework)][framework].append(path)

    python_tests = set(PYTHON_TEST_ROOT.rglob("test_*.py"))
    python_tests.update(PYTHON_TEST_ROOT.rglob("*_test.py"))
    for path in sorted(python_tests):
        if "__pycache__" not in path.parts:
            framework = classify_python_runner(path)
            discovered[classify_name(path, framework)][framework].append(path)

    for path in sorted(E2E_TEST_ROOT.rglob("*.spec.js")):
        discovered[classify_name(path, "playwright")]["playwright"].append(path)

    return discovered


E2E_RESOURCE_BY_FILE = {
    "knowledge-center-outline-catalog.spec.js": "service-read",
    "knowledge-center-scroll-contract.spec.js": "service-read",
    "knowledge-center-cleaning-upload-real.spec.js": "database-write",
    "knowledge-center-incremental-flow.spec.js": "database-write",
    "knowledge-center-personnel.spec.js": "database-write",
    "knowledge-center-review-publishing.spec.js": "database-write",
    "knowledge-center-review-workbench.spec.js": "service-read",
    "knowledge-center-template-management.spec.js": "database-write",
    "knowledge-center-handbook-production-p0p1.spec.js": "database-write",
    "knowledge-center-outline-delete-candidate.spec.js": "database-write",
    "knowledge-assets-workspace.spec.js": "service-read",
    "knowledge-center-gitlab.spec.js": "service-read",
    "knowledge-center-authentication.spec.js": "service-read",
    "knowledge-center-permissions.spec.js": "service-read",
    "knowledge-center-entry.spec.js": "service-read",
    "knowledge-center-incremental.spec.js": "service-read",
    "knowledge-center-outlines-layout.spec.js": "service-read",
    "knowledge-center-searchable-combobox.spec.js": "service-read",
    "review-reader-regression.spec.js": "service-read",
    "knowledge-center-performance.gate.spec.js": "performance",
}


def make_task(suite: str, framework: str, files: Iterable[Path], resource: str = "") -> TestTask | None:
    selected = tuple(sorted(files))
    if not selected:
        return None
    framework_names = {
        "jest": "Jest",
        "node-test": "Node test",
        "node-script": "Node 独立脚本",
        "unittest": "Python unittest",
        "pytest": "Python pytest",
        "python-script": "Python 独立脚本",
        "playwright": "Playwright",
    }
    return TestTask(
        suite=suite,
        framework=framework,
        label=f"{suite} / {framework_names[framework]}",
        files=selected,
        resource=resource,
    )


def build_tasks(command: str) -> list[TestTask]:
    if command == "smoke":
        smoke_paths = [REPOSITORY_ROOT / item for item in SMOKE_FILES]
        missing = [relative(path) for path in smoke_paths if not path.is_file()]
        if missing:
            raise RuntimeError(f"冒烟测试清单包含不存在的文件: {', '.join(missing)}")
        tasks = []
        grouped: dict[str, list[Path]] = {framework: [] for framework in FRAMEWORKS}
        for path in smoke_paths:
            framework = classify_node_runner(path) if path.suffix == ".js" else classify_python_runner(path)
            grouped[framework].append(path)
        for framework in FRAMEWORKS:
            task = make_task("smoke", framework, grouped[framework])
            if task:
                tasks.append(task)
        return tasks

    suites = FULL_SUITES if command in {"full", "all"} else (command,)
    discovered = discover_test_files()
    tasks: list[TestTask] = []
    for suite in suites:
        for framework in FRAMEWORKS:
            files = discovered[suite][framework]
            if framework == "playwright" and suite == "e2e":
                # Group specs by an explicit resource contract. Playwright can
                # schedule read-only files across workers, while the write lane
                # remains a single worker. Unknown files default to write.
                for resource in ("service-read", "database-write"):
                    task = make_task(
                        suite,
                        framework,
                        (
                            path for path in files
                            if E2E_RESOURCE_BY_FILE.get(path.name, "database-write") == resource
                        ),
                        resource,
                    )
                    if task:
                        tasks.append(task)
                continue
            if framework in {"node-script", "python-script", "unittest", "pytest"}:
                tasks.extend(make_task(suite, framework, (path,)) for path in files)
            else:
                task = make_task(suite, framework, files)
                if task:
                    tasks.append(task)
    return tasks


def task_command(task: TestTask, jobs: int = 1) -> list[str]:
    files = [relative(path) for path in task.files]
    if task.framework == "jest":
        worker_flag = f"--maxWorkers={jobs}" if task_resource(task) == "isolated-cpu" and jobs > 1 else "--runInBand"
        return [
            *node_tool("jest"),
            "--config", relative(JEST_CONFIG), worker_flag, "--verbose", *files,
        ]
    if task.framework == "node-test":
        return ["node", "--test", *files]
    if task.framework == "node-script":
        return ["node", files[0]]
    if task.framework == "unittest":
        return [python_executable(), "-m", "unittest", "-v", *files]
    if task.framework == "pytest":
        return [python_executable(), "-m", "pytest", "-v", *files]
    if task.framework == "python-script":
        return [python_executable(), files[0]]
    if task.framework == "playwright":
        command = [
            *node_tool("playwright"), "test",
            "--config", relative(PLAYWRIGHT_CONFIG),
            "--reporter=list", *files,
        ]
        workers = 1
        if task_resource(task) == "service-read":
            workers = max(1, min(jobs, 2))
        command.extend(("--workers", str(workers)))
        if task.suite == "gate":
            command.extend(("--project", "chromium"))
        return command
    raise ValueError(f"未知测试框架: {task.framework}")


def node_module_roots() -> list[Path]:
    candidates = (
        REPOSITORY_ROOT / "node_modules",
        REPOSITORY_ROOT / "apps" / "knowledge-center-api" / "node_modules",
        REPOSITORY_ROOT / "runtime" / "agent-runner" / "node_modules",
    )
    return [path for path in candidates if path.is_dir()]


def node_tool(name: str) -> list[str]:
    for module_root in node_module_roots():
        executable = module_root / ".bin" / name
        if executable.is_file():
            return [str(executable)]
    return ["npx", "--no-install", name]


def python_executable() -> str:
    return os.environ.get("TEST_PYTHON", sys.executable)


def test_environment(
    task: TestTask | None = None,
    run_context: RunContext | None = None,
    knowledge_center_base_url: str | None = None,
    knowledge_center_test_run_id: str | None = None,
    knowledge_center_storage_url: str | None = None,
) -> dict[str, str]:
    env = os.environ.copy()
    python_paths = [
        str(REPOSITORY_ROOT / "apps" / "pingcode-api"),
        str(REPOSITORY_ROOT / "packages" / "pingcode-core"),
    ]
    if task and task.framework in {"unittest", "pytest", "python-script"}:
        python_paths.extend(str(path.parent) for path in task.files)
    if env.get("PYTHONPATH"):
        python_paths.append(env["PYTHONPATH"])
    env["PYTHONPATH"] = os.pathsep.join(python_paths)
    node_paths = [str(path) for path in node_module_roots()]
    if env.get("NODE_PATH"):
        node_paths.append(env["NODE_PATH"])
    if node_paths:
        env["NODE_PATH"] = os.pathsep.join(node_paths)
    # 统一入口准备和探活的是同一个知识中心实例。性能门禁不能在未显式配置时
    # 回退到测试文件中的远端地址，否则测到的是网络和另一套环境。
    # 每个任务都必须指向 runner 明确准备的实例；调用方未传入隔离地址时，
    # 固定使用默认本地入口，避免继承 shell 或历史服务残留的 KPG_BASE_URL。
    env["KPG_BASE_URL"] = knowledge_center_base_url or KNOWLEDGE_CENTER_BASE_URL
    if knowledge_center_test_run_id:
        env["KNOWLEDGE_CENTER_TEST_RUN_ID"] = knowledge_center_test_run_id
    if knowledge_center_storage_url:
        env["KC_STORAGE_URL"] = knowledge_center_storage_url
        env["YASDB_STORAGE_URL"] = knowledge_center_storage_url
    if run_context:
        env["YASDB_TEST_RUN_DIR"] = str(run_context.run_dir)
        # Playwright clears its outputDir at startup. Each invocation needs its
        # own directory so later batches cannot erase earlier failure evidence.
        artifact_dir = run_context.artifact_dir
        if task:
            identity = "\n".join([task.suite, task.framework, *(str(path) for path in task.files)])
            suffix = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:12]
            artifact_dir = artifact_dir / f"{task.suite}-{task.framework}-{suffix}"
        env["YASDB_TEST_ARTIFACT_DIR"] = str(artifact_dir)
        env["YASDB_TEST_TMP_DIR"] = str(TEST_RESULT_ROOT / "tmp")
    return env


def extract_failed_tests(framework: str, output: str) -> tuple[str, ...]:
    patterns = {
        "jest": (r"^\s*●\s+(.+)$", r"^FAIL\s+(\S+)"),
        "node-script": (r"^\s*[✗❌]\s*(.+)$",),
        "unittest": (r"^(\S+ \([^\n]+\)) \.\.\. (?:FAIL|ERROR)$", r"^(?:FAIL|ERROR):\s+(.+)$"),
        "pytest": (r"^(?:FAILED|ERROR)\s+(.+?)(?:\s+-\s+.*)?$",),
        "python-script": (r"^\s*[✗❌]\s*(.+)$",),
        "playwright": (r"^\s*\d+\)\s+(.+)$",),
    }
    failures: list[str] = []
    for pattern in patterns.get(framework, ()):
        for match in re.finditer(pattern, output, re.MULTILINE):
            value = match.group(1).strip()
            if value and value not in failures:
                failures.append(value)
    return tuple(failures)


def framework_reported_zero_tests(framework: str, output: str) -> bool:
    return framework == "unittest" and re.search(r"^Ran 0 tests?", output, re.MULTILINE) is not None


def extract_test_counts(framework: str, output: str) -> tuple[int | None, int | None, int | None, int | None]:
    """Return total, passed, failed, skipped when a framework exposes reliable counts."""
    if framework == "jest":
        match = re.search(
            r"Tests:\s+(?:(\d+) failed,\s*)?(?:(\d+) skipped,\s*)?(?:(\d+) passed,\s*)?(\d+) total",
            output,
        )
        if match:
            failed, skipped, passed, total = (int(value or 0) for value in match.groups())
            return total, passed, failed, skipped
    if framework == "unittest":
        total_match = re.search(r"^Ran (\d+) tests?", output, re.MULTILINE)
        if total_match:
            total = int(total_match.group(1))
            failed = sum(int(value) for value in re.findall(r"(?:failures|errors)=(\d+)", output))
            skipped_match = re.search(r"skipped=(\d+)", output)
            skipped = int(skipped_match.group(1)) if skipped_match else 0
            return total, max(0, total - failed - skipped), failed, skipped
    if framework == "pytest":
        summary = re.search(r"=+\s+(.+?)\s+in\s+[\d.]+s\s+=+", output)
        if summary:
            values = {name: int(count) for count, name in re.findall(r"(\d+) (passed|failed|skipped|error|errors)", summary.group(1))}
            failed = values.get("failed", 0) + values.get("error", 0) + values.get("errors", 0)
            passed = values.get("passed", 0)
            skipped = values.get("skipped", 0)
            return passed + failed + skipped, passed, failed, skipped
    if framework == "node-test":
        values = {
            name: int(count)
            for name, count in re.findall(r"^# (tests|pass|fail|skipped) (\d+)$", output, re.MULTILINE)
        }
        if "tests" in values:
            return values["tests"], values.get("pass", 0), values.get("fail", 0), values.get("skipped", 0)
    if framework == "playwright":
        values = {name: int(count) for count, name in re.findall(r"(\d+) (passed|failed|skipped|did not run)", output)}
        if values:
            passed = values.get("passed", 0)
            failed = values.get("failed", 0)
            skipped = values.get("skipped", 0) + values.get("did not run", 0)
            return passed + failed + skipped, passed, failed, skipped
    return None, None, None, None


def collect_case_results(framework: str, output: str, result_path: Path | None) -> tuple[dict[str, Any], ...]:
    """Read framework records; scripts without a case protocol remain uncounted."""
    cases = []
    def add(name, status, duration=None, detail="", file=""):
        cases.append(dict(name=name, status=status, duration_seconds=duration, detail=detail, file=file))
    if result_path and result_path.is_file():
        if framework == "jest":
            raw = json.loads(result_path.read_text(encoding="utf-8"))
            for suite in raw.get("testResults", []):
                for case in suite.get("assertionResults", []):
                    status = case.get("status")
                    add(case.get("fullName", case.get("title", "未命名用例")),
                        {"passed": "PASS", "failed": "FAIL", "pending": "SKIP", "todo": "SKIP"}.get(status, "NOT_RUN"),
                        case["duration"] / 1000 if case.get("duration") is not None else None,
                        "\n".join(case.get("failureMessages", [])), suite.get("name", ""))
        elif framework == "pytest":
            for case in ET.parse(result_path).iter("testcase"):
                failures = list(case.findall("failure")) + list(case.findall("error"))
                skipped = case.find("skipped")
                add(case.get("classname", "") + "::" + case.get("name", ""),
                    "FAIL" if failures else "SKIP" if skipped is not None else "PASS",
                    float(case.get("time", 0)),
                    "\n".join((item.text or item.get("message", "")) for item in failures) if failures else
                    ((skipped.text or skipped.get("message", "")) if skipped is not None else ""), case.get("file", ""))
        elif framework == "playwright":
            raw = json.loads(result_path.read_text(encoding="utf-8"))
            def visit(suite, parents=()):
                for spec in suite.get("specs", []):
                    for test in spec.get("tests", []):
                        attempts = test.get("results", [])
                        last = attempts[-1] if attempts else {}
                        status = test.get("status")
                        add(" › ".join((*parents, spec.get("title", ""), test.get("projectName", ""))),
                            "PASS" if status in {"expected", "flaky"} else "SKIP" if status == "skipped" else "FAIL",
                            sum(item.get("duration", 0) for item in attempts) / 1000,
                            "\n".join(error.get("message", "") for item in attempts for error in item.get("errors", [])),
                            spec.get("file", ""))
                for child in suite.get("suites", []):
                    visit(child, (*parents, child.get("title", "")))
            for suite in raw.get("suites", []):
                visit(suite)
    if not cases and framework == "unittest":
        for match in re.finditer(r"^(.+?) \.\.\. (ok|FAIL|ERROR|skipped[^\n]*|expected failure|unexpected success)$", output, re.MULTILINE):
            name, outcome = match.groups()
            status = "PASS" if outcome == "ok" else "SKIP" if outcome.startswith(("skipped", "expected")) else "FAIL"
            add(name, status, detail=output if status == "FAIL" else outcome if status == "SKIP" else "")
    if not cases and framework == "node-test":
        # TAP suite records contain '# type: suite'; only leaf tests are counted.
        lines = output.splitlines()
        for index, line in enumerate(lines):
            match = re.match(r"^\s*(not ok|ok) \d+ - (.*)$", line)
            if not match:
                continue
            block = []
            for following in lines[index + 1:]:
                if re.match(r"^\s*(?:not ok|ok) \d+ - |^\s*# Subtest:|^\s*1\.\.", following):
                    break
                block.append(following)
            detail = "\n".join(block)
            if re.search(r"type: ['\"]?suite", detail):
                continue
            name = match.group(2)
            status = "SKIP" if re.search(r"# (SKIP|TODO)\b", name, re.I) else "FAIL" if match.group(1) == "not ok" else "PASS"
            duration = re.search(r"duration_ms: ([\d.]+)", detail)
            add(re.sub(r"\s+# (SKIP|TODO).*", "", name, flags=re.I), status,
                float(duration.group(1)) / 1000 if duration else None, detail if status == "FAIL" else "")
    return tuple(cases)


def http_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return 200 <= response.status < 500
    except (OSError, urllib.error.URLError):
        return False


def wait_for_http(url: str, timeout_seconds: int) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if http_ready(url):
            return True
        time.sleep(1)
    return False


def reserve_local_ports(count: int) -> tuple[int, ...]:
    sockets = []
    try:
        for _ in range(count):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(("127.0.0.1", 0))
            sockets.append(sock)
        return tuple(sock.getsockname()[1] for sock in sockets)
    finally:
        for sock in sockets:
            sock.close()


def process_identity(pid: int) -> str | None:
    try:
        fields = (Path("/proc") / str(pid) / "stat").read_text(encoding="utf-8").split()
    except (OSError, ValueError):
        return None
    return fields[21] if len(fields) > 21 else None


def read_lease_processes(state_dir: Path) -> dict[str, tuple[int, str]]:
    identities = {}
    for service in ("storage", "document", "pingcode", "frontend"):
        try:
            pid = int((state_dir / f"{service}.pid").read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            continue
        identity = process_identity(pid)
        if identity is not None:
            identities[service] = (pid, identity)
    return identities


def isolated_knowledge_center_environment(context: RunContext) -> tuple[dict[str, str], str, str]:
    test_database_config = TEST_DATABASE_CONFIG_DIR / "service.env"
    if not test_database_config.is_file():
        raise RuntimeError(
            f"缺少测试数据库配置：{test_database_config.relative_to(REPOSITORY_ROOT)}"
        )
    config_text = test_database_config.read_text(encoding="utf-8")
    username = re.search(r'^YASDB_USERNAME=["\']?([^"\'\r\n]+)', config_text, re.MULTILINE)
    if not username or username.group(1).strip().lower() != "test_hy":
        raise RuntimeError("测试数据库配置必须使用 test_hy 独立 Schema 账号")
    frontend, document, pingcode, storage = reserve_local_ports(4)
    service_root = context.details_dir / "knowledge-center"
    state_dir = service_root / "state"
    log_dir = service_root / "logs"
    owner = f"test-run:{context.run_id}:{uuid4().hex}"
    env = test_environment(run_context=context).copy()
    # 隔离实例必须只从测试专用配置加载 JDBC 凭据，不得继承当前
    # Shell 中可能指向业务 Schema 的显式覆盖。
    for key in ("YASDB_JDBC_URL", "YASDB_USERNAME", "YASDB_PASSWORD"):
        env.pop(key, None)
    env.update({
        "KNOWLEDGE_CENTER_FRONTEND_PORT": str(frontend),
        "KNOWLEDGE_CENTER_DOCUMENT_API_PORT": str(document),
        "KNOWLEDGE_CENTER_PINGCODE_API_PORT": str(pingcode),
        "YASDB_STORAGE_PORT": str(storage),
        "YASDB_STORAGE_URL": f"http://127.0.0.1:{storage}",
        "KNOWLEDGE_CENTER_INTERNAL_HOST": "127.0.0.1",
        "KNOWLEDGE_CENTER_PUBLIC_BASE_URL": f"http://127.0.0.1:{frontend}",
        "KNOWLEDGE_CENTER_PINGCODE_HOST": "127.0.0.1",
        "KNOWLEDGE_CENTER_STATE_DIR": str(state_dir),
        "KNOWLEDGE_CENTER_LOG_DIR": str(log_dir),
        "KNOWLEDGE_CENTER_RUN_OWNER": owner,
        "KNOWLEDGE_CENTER_NO_TAKEOVER": "1",
        "KNOWLEDGE_CENTER_OPERATION_ACTOR": "unified-test-runner",
        "KNOWLEDGE_CENTER_STOP_REASON": f"test-run-cleanup:{context.run_id}",
        "KNOWLEDGE_CENTER_ENV": "test",
        "KNOWLEDGE_CENTER_ENVIRONMENT": "test",
        "KNOWLEDGE_CENTER_TEST_RUN_ID": context.run_id,
        "KNOWLEDGE_CENTER_E2E_INITIALIZE_PRODUCTION": "1",
        "KNOWLEDGE_CENTER_E2E_INITIALIZATION_DIR": str(service_root / "production-initialization"),
        "YASDB_CONFIG_DIR": str(TEST_DATABASE_CONFIG_DIR),
        "KNOWLEDGE_STORAGE_MODE": "database",
        "KNOWLEDGE_CENTER_AUTH_STORE": str(service_root / "data" / "auth.json"),
        "INCREMENTAL_BUILD_STATE": str(service_root / "data" / "incremental-build-state.json"),
    })
    base_url = f"http://127.0.0.1:{frontend}"
    return env, base_url, owner


def acquire_e2e_database_lock(timeout_seconds: int = 600):
    E2E_DATABASE_LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    lock = E2E_DATABASE_LOCK_FILE.open("a+", encoding="utf-8")
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            lock.seek(0)
            lock.truncate()
            lock.write(f"pid={os.getpid()} acquiredAt={datetime.now().astimezone().isoformat()}\n")
            lock.flush()
            return lock
        except BlockingIOError:
            if time.monotonic() >= deadline:
                lock.close()
                raise RuntimeError("等待 test_hy E2E 独占锁超时")
            time.sleep(1)


def synchronize_e2e_database(context: RunContext, lock) -> str:
    if not E2E_DATABASE_SYNC_SCRIPT.is_file():
        raise RuntimeError(f"缺少 E2E 数据库同步脚本：{relative(E2E_DATABASE_SYNC_SCRIPT)}")
    output_dir = context.details_dir / "database-sync"
    env = os.environ.copy()
    env.update({
        "KNOWLEDGE_CENTER_E2E_DB_LOCK_HELD": "1",
        "YASDB_E2E_SYNC_OUTPUT_DIR": str(output_dir),
        "YASDB_E2E_SYNC_LOCK_FILE": str(E2E_DATABASE_LOCK_FILE),
    })
    completed = subprocess.run(
        [str(E2E_DATABASE_SYNC_SCRIPT)],
        cwd=REPOSITORY_ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    (output_dir / "execution.log").write_text(completed.stdout, encoding="utf-8")
    if completed.returncode != 0:
        raise RuntimeError(completed.stdout.strip() or "pf_knowledge 到 test_hy 同步失败")
    report = output_dir / "report.json"
    if not report.is_file() or not json.loads(report.read_text(encoding="utf-8")).get("passed"):
        raise RuntimeError("test_hy 同步缺少通过的对账报告")
    return completed.stdout.strip()


def migrate_e2e_database(context: RunContext, environment: dict[str, str]) -> str:
    """Build the worktree and apply only committed migrations to locked test_hy."""
    for required in (KNOWLEDGE_CENTER_BUILD_SCRIPT, YASHANDB_STORAGE_SCRIPT):
        if not required.is_file():
            raise RuntimeError(f"缺少 E2E 数据库迁移入口：{relative(required)}")
    output_dir = context.details_dir / "database-migration"
    output_dir.mkdir(parents=True, exist_ok=True)
    build = subprocess.run(
        [str(KNOWLEDGE_CENTER_BUILD_SCRIPT)],
        cwd=REPOSITORY_ROOT,
        env=environment,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    (output_dir / "build.log").write_text(build.stdout, encoding="utf-8")
    if build.returncode != 0:
        raise RuntimeError(build.stdout.strip() or "E2E 当前工作树构建失败")

    migration = subprocess.run(
        [str(YASHANDB_STORAGE_SCRIPT), "migrate"],
        cwd=REPOSITORY_ROOT,
        env=environment,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    (output_dir / "execution.log").write_text(migration.stdout, encoding="utf-8")
    report = {
        "generatedAt": datetime.now().astimezone().isoformat(),
        "targetSchema": "test_hy",
        "buildPassed": build.returncode == 0,
        "migrationPassed": migration.returncode == 0,
        "passed": build.returncode == 0 and migration.returncode == 0,
    }
    (output_dir / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if migration.returncode != 0:
        raise RuntimeError(migration.stdout.strip() or "test_hy 当前工作树迁移失败")
    return migration.stdout.strip()


def release_e2e_database_lock(lock) -> None:
    if lock is None or lock.closed:
        return
    fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
    lock.close()


def ensure_knowledge_center(context: RunContext) -> tuple[bool, KnowledgeCenterLease | None, str]:
    """Always start an owned instance backed by the dedicated test schema."""
    if not KNOWLEDGE_CENTER_SCRIPT.is_file():
        return False, None, f"缺少启动脚本：{KNOWLEDGE_CENTER_SCRIPT}"
    try:
        env, base_url, owner = isolated_knowledge_center_environment(context)
    except RuntimeError as error:
        return False, None, str(error)
    database_lock = None
    try:
        database_lock = acquire_e2e_database_lock()
        synchronize_e2e_database(context, database_lock)
        migrate_e2e_database(context, env)
    except RuntimeError as error:
        release_e2e_database_lock(database_lock)
        return False, None, str(error)
    health_url = base_url + "/knowledge-center/api/auth/config"
    last_output = ""
    for arguments in (("start", "--no-build"), ("start",)):
        completed = subprocess.run(
            [str(KNOWLEDGE_CENTER_SCRIPT), *arguments],
            cwd=REPOSITORY_ROOT,
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        last_output = completed.stdout
        if completed.returncode == 0 and http_ready(health_url):
            state_dir = Path(env["KNOWLEDGE_CENTER_STATE_DIR"])
            lease = KnowledgeCenterLease(owner, base_url, health_url, env, state_dir, read_lease_processes(state_dir), database_lock)
            if len(lease.process_identities) != 4:
                return False, lease, "独立测试实例缺少完整进程所有权证据"
            return True, lease, "统一入口已启动 test_hy Schema 隔离的知识中心测试实例"
    release_e2e_database_lock(database_lock)
    return False, None, last_output.strip() or "知识中心服务启动失败"


def stop_owned_knowledge_center(lease: KnowledgeCenterLease) -> bool:
    try:
        actual_owner = (lease.state_dir / "run-owner").read_text(encoding="utf-8").strip()
    except OSError:
        return False
    if actual_owner != lease.owner:
        return False
    for service, (pid, identity) in lease.process_identities.items():
        if process_identity(pid) != identity:
            return False
        try:
            recorded_pid = int((lease.state_dir / f"{service}.pid").read_text(encoding="utf-8").strip())
        except (OSError, ValueError):
            return False
        if recorded_pid != pid:
            return False
    env = lease.environment.copy()
    env["KNOWLEDGE_CENTER_EXPECTED_OWNER"] = lease.owner
    completed = subprocess.run(
        [str(KNOWLEDGE_CENTER_SCRIPT), "stop"],
        cwd=REPOSITORY_ROOT,
        env=env,
        check=False,
    )
    return completed.returncode == 0


def run_task(
    task: TestTask,
    *,
    dry_run: bool,
    timeout: int,
    run_context: RunContext | None = None,
    knowledge_center_base_url: str | None = None,
    knowledge_center_test_run_id: str | None = None,
    knowledge_center_storage_url: str | None = None,
    log_path: Path | None = None,
    jobs: int = 1,
    emit_output: bool = True,
) -> TaskResult:
    command = task_command(task, jobs)
    command_text = shlex.join(command)
    if emit_output:
        print(f"\n{'=' * 72}")
        print(f"执行：{task.label}（{len(task.files)} 个测试文件）")
        print(f"命令：{command_text}")
        print("-" * 72, flush=True)

    if dry_run:
        output = "\n".join([f"命令：{command_text}", *(f"文件：{relative(path)}" for path in task.files)]) + "\n"
        if log_path:
            log_path.write_text(output, encoding="utf-8")
        if emit_output:
            for path in task.files:
                print(f"  - {relative(path)}")
        return TaskResult(
            task.suite, task.label, task.framework, "DRY-RUN", 0.0, 0, len(task.files),
            command=command_text,
            log_file=(log_path.relative_to(run_context.run_dir).as_posix() if log_path and run_context else str(log_path or "")),
        )

    result_path = log_path.with_suffix(".results.xml" if task.framework == "pytest" else ".results.json") if log_path else None
    if result_path and task.framework == "jest":
        command.extend(("--json", "--outputFile", str(result_path)))
    elif result_path and task.framework == "pytest":
        command.append(f"--junitxml={result_path}")
    elif task.framework == "node-test":
        command.insert(2, "--test-reporter=tap")
    elif result_path and task.framework == "playwright":
        command = ["--reporter=list,json" if item == "--reporter=list" else item for item in command]
    command_text = shlex.join(command)
    environment = test_environment(task, run_context, knowledge_center_base_url, knowledge_center_test_run_id, knowledge_center_storage_url)
    if result_path and task.framework == "playwright":
        environment["PLAYWRIGHT_JSON_OUTPUT_FILE"] = str(result_path)
    cases = ()
    started = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            cwd=REPOSITORY_ROOT,
            env=environment,
            timeout=timeout,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        if emit_output and completed.stdout:
            print(completed.stdout, end="" if completed.stdout.endswith("\n") else "\n")
        if log_path:
            log_path.write_text(
                f"命令：{command_text}\n\n{completed.stdout}",
                encoding="utf-8",
            )
        return_code = completed.returncode
        if return_code == 0 and framework_reported_zero_tests(task.framework, completed.stdout):
            if emit_output:
                print("底层框架未收集到任何用例，按失败处理。", file=sys.stderr)
            return_code = 5
        status = "PASS" if return_code == 0 else "FAIL"
        failed_tests = extract_failed_tests(task.framework, completed.stdout)
        if return_code == 5 and not failed_tests:
            failed_tests = ("未收集到测试用例",)
        test_total, test_passed, test_failed, test_skipped = extract_test_counts(task.framework, completed.stdout)
        try:
            cases = collect_case_results(task.framework, completed.stdout, result_path)
        except (OSError, ValueError, ET.ParseError) as error:
            print(f"用例明细读取失败，保留任务日志：{error}", file=sys.stderr)
        if cases:
            test_total = len(cases)
            test_passed, test_failed, test_skipped = (sum(case["status"] == state for case in cases) for state in ("PASS", "FAIL", "SKIP"))
    except FileNotFoundError as error:
        if emit_output:
            print(f"无法启动测试命令：{error}", file=sys.stderr)
        return_code = 127
        status = "FAIL"
        failed_tests = (str(error),)
        test_total = test_passed = test_failed = test_skipped = None
        if log_path:
            log_path.write_text(f"命令：{command_text}\n\n{error}\n", encoding="utf-8")
    except subprocess.TimeoutExpired as error:
        if emit_output:
            print(f"测试执行超过 {timeout} 秒，已终止。", file=sys.stderr)
        return_code = 124
        status = "TIMEOUT"
        failed_tests = (f"任务超时：{task.label}",)
        test_total = test_passed = test_failed = test_skipped = None
        if log_path:
            partial = error.stdout or ""
            if isinstance(partial, bytes):
                partial = partial.decode("utf-8", errors="replace")
            log_path.write_text(f"命令：{command_text}\n\n{partial}\n任务超过 {timeout} 秒。\n", encoding="utf-8")
    except KeyboardInterrupt:
        if emit_output:
            print("测试执行被用户中断。", file=sys.stderr)
        return_code = 130
        status = "INTERRUPTED"
        failed_tests = (f"任务被中断：{task.label}",)
        test_total = test_passed = test_failed = test_skipped = None
        if log_path:
            log_path.write_text(f"命令：{command_text}\n\n任务被用户中断。\n", encoding="utf-8")
    duration = time.monotonic() - started
    log_file = log_path.relative_to(run_context.run_dir).as_posix() if log_path and run_context else str(log_path or "")
    return TaskResult(
        task.suite, task.label, task.framework, status, duration, return_code, len(task.files),
        failed_tests, command_text, test_total, test_passed, test_failed, test_skipped, log_file, cases,
    )


def print_catalog() -> None:
    discovered = discover_test_files()
    print("测试分类清单：")
    for suite in SEMANTIC_SUITES:
        counts = discovered[suite]
        total = sum(len(files) for files in counts.values())
        details = ", ".join(
            f"{framework}={len(files)}" for framework, files in counts.items() if files
        ) or "无用例"
        print(f"  {suite:<12} {total:>3} 个文件（{details}）")
    print(f"  {'smoke':<12} {len(SMOKE_FILES):>3} 个文件（人工维护的快速关键路径）")


def print_summary(results: list[TaskResult], elapsed: float) -> None:
    print(f"\n{'=' * 72}")
    print("测试执行汇总")
    print("=" * 72)
    for result in results:
        print(
            f"[{result.status:<11}] {result.label:<30} "
            f"文件={result.file_count:<3} 耗时={result.duration_seconds:>7.2f}s"
        )
        for failure in result.failed_tests:
            print(f"    - {failure}")
    passed = sum(result.status in {"PASS", "DRY-RUN"} for result in results)
    print("-" * 72)
    print(f"任务：{passed}/{len(results)} 成功；总耗时：{elapsed:.2f}s")
    print("具体成功、失败和跳过的测试用例见上方各框架的详细输出。")


def report_payload(
    command: str,
    results: list[TaskResult],
    elapsed: float,
    coverage: CoverageSummary | None = None,
    generated_at: datetime | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "generatedAt": (generated_at or datetime.now().astimezone()).isoformat(timespec="seconds"),
        "command": command,
        "durationSeconds": round(elapsed, 3),
        "passed": all(result.status in {"PASS", "DRY-RUN"} for result in results)
        and (coverage is None or coverage.status == "PASS"),
        "tasks": [asdict(result) for result in results],
    }
    if coverage is not None:
        payload["coverage"] = asdict(coverage)
        payload["coverageTargets"] = json.loads(COVERAGE_TARGETS.read_text(encoding="utf-8"))
    return payload


SCENE_LABELS = {
    "smoke": "冒烟测试", "gate": "门禁测试", "unit": "单元测试", "contract": "契约测试",
    "integration": "集成测试", "system": "系统测试", "e2e": "端到端测试", "preflight": "环境准备",
}
CASE_STATUS_LABELS = {"PASS": "通过", "FAIL": "失败", "SKIP": "跳过", "NOT_RUN": "未执行", "TIMEOUT": "超时", "INTERRUPTED": "中断", "DRY-RUN": "仅预览"}


def report_escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def report_badge(status: str, large: bool = False) -> str:
    tone = "pass" if status == "PASS" else "fail" if status in {"FAIL", "TIMEOUT", "INTERRUPTED"} else "skip" if status == "SKIP" else ""
    return f'<span class="badge {tone}{" large" if large else ""}">{report_escape(CASE_STATUS_LABELS.get(status, status or "未知"))}</span>'


def report_duration(value: Any, digits: int = 2) -> str:
    return f"{value:.{digits}f} 秒" if isinstance(value, (float, int)) else "未统计"


def report_log_link(task: dict[str, Any], prefix: str = "") -> str:
    from urllib.parse import quote
    raw = task.get("log_file") or ""
    path = Path(raw)
    if not raw or path.is_absolute() or ".." in path.parts or path.parts[:2] != ("details", "tasks") or "\\" in raw:
        return "—"
    return f'<a class="table-link" href="{report_escape(prefix + quote(path.as_posix(), safe="/"))}">任务日志 ↗</a>'


def report_model(payload: dict[str, Any], page_size: int) -> dict[str, Any]:
    scenes: dict[str, dict[str, Any]] = {}
    records = []
    for task_index, task in enumerate(payload.get("tasks") or [], 1):
        scene = task.get("suite") or "unknown"
        if scene not in scenes:
            scenes[scene] = {"id": len(scenes) + 1, "label": SCENE_LABELS.get(scene, scene), "tasks": [], "records": []}
        group = scenes[scene]
        group["tasks"].append(task)
        for case_index, case in enumerate(task.get("cases") or [], 1):
            page = len(group["records"]) // page_size + 1
            anchor = f"case-{task_index}-{case_index}"
            record = {"task": task, "case": case, "id": anchor,
                      "href": f'scenes/scene-{group["id"]}-{page}.html#{anchor}', "scene": group["label"]}
            group["records"].append(record)
            records.append(record)
    for group in scenes.values():
        group["pages"] = max(1, (len(group["records"]) + page_size - 1) // page_size)
    return {"scenes": scenes, "records": records, "page_size": page_size}


def report_search() -> str:
    filters = (("ALL", "全部"), ("PASS", "通过"), ("FAIL", "失败 / 异常"), ("SKIP", "跳过"), ("NOT_RUN", "未执行"))
    buttons = ''.join(f'<button type="button" data-status-filter="{state}" aria-pressed="{"true" if state == "ALL" else "false"}">{label}</button>' for state, label in filters)
    return f'''<section class="search-panel" data-search-panel hidden aria-label="全局用例检索">
<div class="search-controls"><div class="search-field"><label for="case-search">搜索全部用例</label><input id="case-search" data-case-search type="search" placeholder="用例名称、文件、框架或错误关键词" autocomplete="off"></div>
<div class="filters" role="group" aria-label="按用例状态筛选">{buttons}</div><button type="button" class="clear-button" data-clear-search>清除</button></div>
<p class="search-summary" data-search-summary role="status" aria-live="polite"></p><ul class="search-results" data-search-results hidden></ul></section>
<noscript><p class="no-js">当前未启用 JavaScript，可通过场景导航和分页浏览全部用例与日志。</p></noscript>'''


def report_shell(payload: dict[str, Any], model: dict[str, Any], body: str, *, title: str, active: str = "overview", prefix: str = "", subtitle: str = "运行总览") -> str:
    escape = report_escape
    nav = f'<a href="{prefix}report.html"' + (' aria-current="page"' if active == "overview" else '') + '>运行总览</a>'
    for scene, group in model["scenes"].items():
        current = ' aria-current="page"' if active == scene else ''
        nav += f'<a href="{prefix}scenes/scene-{group["id"]}-1.html"{current}><span>{escape(group["label"])}</span><small>{len(group["records"])}</small></a>'
    return f'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)}</title><link rel="stylesheet" href="{prefix}assets/report.css">
<script defer src="{prefix}assets/report.js"></script></head>
<body data-prefix="{prefix}" data-case-count="{len(model['records'])}"><a class="skip-link" href="#main">跳转至报告内容</a><aside class="sidebar" aria-label="报告导航">
<div class="brand"><span class="brand-mark" aria-hidden="true">✓</span>知识中心 · 测试报告</div>
<p class="side-caption">本次运行</p><nav aria-label="测试场景">{nav}</nav><div class="side-footer">离线报告<br>结果、用例与执行证据</div></aside>
<main class="workspace" id="main"><header class="topbar"><span><a href="{prefix}report.html">测试报告</a> / {escape(subtitle)}</span><span class="tag">{escape(payload.get("command") or "测试")} · 本次运行</span></header>
{body}<footer class="footer"><span>知识中心管理平台 · 统一测试报告<br>生成于 {escape(payload.get("generatedAt") or "未记录")}</span><a href="{prefix}details/report.json">原始 JSON ↗</a></footer></main></body></html>'''


def report_coverage(payload: dict[str, Any]) -> str:
    escape = report_escape
    coverage = payload.get("coverage")
    heading = '<section class="panel" id="coverage"><div class="panel-head"><h2>覆盖率门禁</h2><small>独立检查每个运行时</small></div>'
    if not coverage:
        return heading + '<div class="panel-body"><p>本次未启用覆盖率采集。</p><p class="muted">使用 <code>--coverage</code> 采集覆盖率；测试通过与覆盖率达标分别判定。</p></div></section>'
    targets = payload.get("coverageTargets") or {}
    rows = []
    for runtime, result in (coverage.get("runtime_metrics") or {}).items():
        cells = [f'<strong>{escape(runtime)}</strong><small>{escape(result.get("source_files", "未统计"))} 个源文件</small>']
        deficits = []
        measured = True
        runtime_passed = True
        for metric, label in (("lines", "行"), ("branches", "分支")):
            value = (result.get("summary") or {}).get(metric) or {}
            covered, total = value.get("covered", 0), value.get("total", 0)
            target = (targets.get(runtime) or {}).get(metric)
            if not total:
                cells.append('未统计')
                measured = False
            else:
                pct = covered / total * 100
                gate = target is not None and covered * 100 >= total * target
                runtime_passed = runtime_passed and gate
                needed = max(0, -(-(total * target) // 100) - covered) if target is not None else None
                if needed:
                    deficits.append(f'{label}还差 {needed} 项')
                cells.append(f'<strong class="{"" if gate else "fail-text"}">{pct:.2f}%</strong><div class="bar" aria-hidden="true"><span style="width:{min(100, max(0, pct)):.2f}%"></span></div><div class="coverage-detail">{covered}/{total} · 目标 {escape(str(target) + "%" if target is not None else "未提供")}</div>')
        state = '未采集' if not measured else '达标' if runtime_passed else '未达标'
        tone = 'pass' if state == '达标' else 'fail' if state == '未达标' else ''
        cells.append(f'<span class="badge {tone}">{state}</span><small>{escape("；".join(deficits))}</small>')
        rows.append('<tr>' + ''.join(f'<td>{cell}</td>' for cell in cells) + '</tr>')
    if not rows:
        metrics = coverage.get("metrics") or {}
        rows.append('<tr><td>汇总</td><td>' + escape(metrics.get('lines', '未统计')) + '</td><td>' + escape(metrics.get('branches', '未统计')) + '</td><td>未提供运行时明细</td></tr>')
    return heading + '<div class="panel-body">' + report_badge(coverage.get('status', '')) + '<p class="muted long-text">' + escape(coverage.get('diagnostic') or '按原始计数检查门禁，不以显示值四舍五入判定。') + '</p></div><div class="table-wrap"><table><thead><tr><th>运行时</th><th>行覆盖率</th><th>分支覆盖率</th><th>门禁与缺口</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div></section>'


def render_html_report(payload: dict[str, Any], model: dict[str, Any] | None = None) -> str:
    """Render a professional, offline summary without inventing missing telemetry."""
    escape = report_escape
    model = model or report_model(payload, 50)
    tasks = payload.get("tasks") or []
    known = [task for task in tasks if task.get("test_total") is not None]
    count = lambda field: sum(task.get(field) or 0 for task in known)
    total = count('test_total')
    passed, failed, skipped = count('test_passed'), count('test_failed'), count('test_skipped')
    pending = max(0, total - passed - failed - skipped)
    success_tasks = sum(task.get('status') == 'PASS' for task in tasks)
    preview = bool(tasks) and all(task.get('status') == 'DRY-RUN' for task in tasks)
    status = 'DRY-RUN' if preview else 'PASS' if payload.get('passed') and tasks else 'FAIL' if tasks else 'NOT_RUN'
    heading = '运行仅预览' if preview else '本次测试全部通过' if status == 'PASS' else '本次运行存在失败或阻塞' if tasks else '本次没有测试任务'
    stats = (("已识别用例", total if known else "未统计", f"{len(model['records'])} 条逐条明细"),
             ("用例通过率", f"{passed / total * 100:.1f}%" if total else "—", f"通过 / 失败 / 跳过：{passed} / {failed} / {skipped}" if known else "用例数量未统计"),
             ("通过任务", f"{success_tasks} / {len(tasks)}", f"测试文件 {sum(task.get('file_count') or 0 for task in tasks)} 个"),
             ("运行耗时", report_duration(payload.get('durationSeconds')), "本次运行总耗时"))
    cards = ''.join(f'<div class="metric-card"><div class="metric-label">{escape(label)}</div><div class="metric-value">{escape(value)}</div><div class="metric-note">{escape(note)}</div></div>' for label, value, note in stats)
    body = f'<div class="hero"><div><div class="eyebrow">测试质量 / {escape(str(payload.get("command") or "测试").upper())}</div><h1>测试运行总览</h1><div class="hero-meta"><span>{escape(payload.get("generatedAt") or "时间未记录")}</span><span>{escape(heading)}</span></div></div>{report_badge(status, True)}</div><div class="metrics">{cards}</div>'
    unknown = len(tasks) - len(known)
    if unknown:
        body += f'<p class="alert">统计范围：{unknown} 个任务未提供可靠用例数量；上方用例数字仅包含已识别结果。任务异常请查看“失败与阻塞”和原始日志。</p>'
    if total and pending:
        body += f'<p class="alert">另有 {pending} 条用例未执行或未归类为通过、失败、跳过；请查看场景明细。</p>'
    segments = [passed, failed, skipped, pending]
    colors = ['var(--pass)', 'var(--fail)', 'var(--skip)', 'var(--neutral)']
    cursor, stops = 0.0, []
    for value, color in zip(segments, colors):
        start = cursor
        cursor += value / total * 100 if total else 0
        stops.append(f'{color} {start:.4f}% {cursor:.4f}%')
    ring = f'conic-gradient({",".join(stops)})' if total else '#e8edf3'
    legend = ''.join(f'<div class="legend-row"><span><i class="dot {tone}" aria-hidden="true"></i>{label}</span><strong>{value}</strong></div>' for label, value, tone in (("通过", passed, 'pass'), ("失败", failed, 'fail'), ("跳过", skipped, 'skip'), ("其他 / 未执行", pending, '')))
    distribution = f'<section class="panel"><div class="panel-head"><h2>用例结果分布</h2><small>已识别用例</small></div><div class="panel-body distribution"><div class="donut" style="--ring:{ring}" role="img" aria-label="通过{passed}，失败{failed}，跳过{skipped}，其他{pending}"><div class="donut-hole"><strong>{total if known else "—"}</strong><small>用例总数</small></div></div><div class="legend">{legend}</div></div></section>'
    task_rows = []
    for task in tasks:
        task_rows.append('<tr>' + ''.join(f'<td>{cell}</td>' for cell in (
            report_badge(task.get('status', '')), f'<strong>{escape(task.get("label") or "未命名任务")}</strong><small>{escape(SCENE_LABELS.get(task.get("suite"), task.get("suite") or "—"))}</small>',
            escape(task.get('framework') or '—'), escape(task.get('test_total') if task.get('test_total') is not None else '未统计'), escape(report_duration(task.get('duration_seconds'))), report_log_link(task))) + '</tr>')
    failures = []
    case_failures = [record for record in model['records'] if record['case'].get('status') in {'FAIL', 'TIMEOUT', 'INTERRUPTED'}]
    for record in case_failures[:8]:
        case = record['case']
        first_line = next((line.strip() for line in (case.get('detail') or '').splitlines() if line.strip()), '')
        diagnostic = f'<p class="failure-diagnostic">{escape(first_line[:240])}{"…" if len(first_line) > 240 else ""}</p>' if first_line else ''
        failures.append(f'<li><div class="failure-title">{report_badge(case.get("status", "FAIL"))}<a href="{escape(record["href"])}">{escape(case.get("name") or "未命名用例")}</a></div><small>{escape(record["scene"])} · {escape(case.get("file") or record["task"].get("framework") or "")}</small>{diagnostic}</li>')
    if len(case_failures) > 8:
        failures.append(f'<li class="failure-more">另有 {len(case_failures) - 8} 条失败或异常用例。<a href="#status=FAIL">查看全部失败用例</a></li>')
    abnormal_tasks = [task for task in tasks if task.get('status') not in {'PASS', 'DRY-RUN'}]
    for task in abnormal_tasks:
        messages = task.get('failed_tests') or [CASE_STATUS_LABELS.get(task.get('status'), '异常任务')]
        failures.append(f'<li><div class="failure-title">{report_badge(task.get("status", ""))}<strong>{escape(task.get("label") or "未命名任务")}</strong></div><p>{escape("；".join(messages))}</p>{report_log_link(task)}</li>')
    fail_body = '<ul class="failure-list">' + ''.join(failures) + '</ul>' if failures else '<div class="empty">无失败项。<br><small>本次未记录失败用例或异常任务。</small></div>'
    failure_panel = f'<section class="panel" id="failures"><div class="panel-head"><div><h2>失败与阻塞</h2><small>{len(case_failures)} 条失败或异常用例 · {len(abnormal_tasks)} 个异常任务</small></div><a href="#status=FAIL">筛选失败用例</a></div>{fail_body}</section>'
    body += '<div class="grid">' + distribution + failure_panel + '</div>' + report_search()
    scenes = []
    for group in model['scenes'].values():
        cases = group['records']
        states = {state: sum(record['case'].get('status') == state for record in cases) for state in ('PASS', 'SKIP', 'NOT_RUN')}
        states['FAIL'] = sum(record['case'].get('status') in {'FAIL', 'TIMEOUT', 'INTERRUPTED'} for record in cases)
        pass_pct = states['PASS'] / len(cases) * 100 if cases else 0
        missing = sum(not task.get('cases') for task in group['tasks'])
        scenes.append(f'<tr><td><a class="table-link" href="scenes/scene-{group["id"]}-1.html"><strong>{escape(group["label"])}</strong></a><small>{len(group["tasks"])} 个任务 · {group["pages"]} 页</small></td><td class="number">{len(cases)}</td><td class="number">{states["PASS"]}</td><td class="number {"fail-text" if states["FAIL"] else ""}">{states["FAIL"]}</td><td class="number">{states["SKIP"]}</td><td class="number">{states["NOT_RUN"]}</td><td>{pass_pct:.1f}%<div class="bar" aria-hidden="true"><span style="width:{pass_pct:.2f}%"></span></div></td><td>{missing}</td></tr>')
    body += '<section class="panel" id="scenes"><div class="panel-head"><h2>测试场景</h2><small>按场景进入用例明细</small></div><div class="table-wrap"><table><thead><tr><th>场景</th><th class="number">明细用例</th><th class="number">通过</th><th class="number">失败 / 异常</th><th class="number">跳过</th><th class="number">未执行</th><th>通过率</th><th>无明细任务</th></tr></thead><tbody>' + ''.join(scenes) + '</tbody></table></div></section>'
    body += report_coverage(payload)
    body += '<section class="panel" id="tasks"><div class="panel-head"><h2>任务结果</h2><small>框架执行结果与原始日志</small></div><div class="table-wrap"><table><thead><tr><th>状态</th><th>任务 / 场景</th><th>框架</th><th>用例</th><th>耗时</th><th>执行证据</th></tr></thead><tbody>' + ''.join(task_rows) + '</tbody></table></div></section>'
    slow = sorted(tasks, key=lambda task: task.get('duration_seconds') or 0, reverse=True)[:5]
    slow_rows = ''.join(f'<tr><td>{escape(task.get("label") or "未命名任务")}</td><td>{escape(report_duration(task.get("duration_seconds")))}</td><td>{report_badge(task.get("status", ""))}</td></tr>' for task in slow)
    body += '<section class="panel"><div class="panel-head"><h2>耗时较长的任务</h2><small>按任务耗时降序 · 最多 5 项</small></div><div class="table-wrap"><table><thead><tr><th>任务</th><th>耗时</th><th>状态</th></tr></thead><tbody>' + slow_rows + '</tbody></table></div></section>'
    body += f'<section class="panel"><div class="panel-head"><h2>运行信息与统计口径</h2></div><div class="panel-body"><h3>执行入口</h3><div class="command-line mono">python3 tests/run_tests.py {escape(payload.get("command") or "")}</div><p class="muted">任务状态与用例状态独立统计；没有逐条明细的任务不虚构为单条用例。仅预览不代表实际执行成功。</p><p class="muted">本次报告未提供历史趋势、重试记录和附件信息；不据此推断测试稳定性。</p><a class="table-link" href="details/report.json">查看 JSON 报告 ↗</a></div></section>'
    return report_shell(payload, model, body, title=f'{payload.get("command") or "测试"} 测试报告')


def report_scene_page(payload: dict[str, Any], model: dict[str, Any], scene: str, group: dict[str, Any], page: int) -> str:
    escape = report_escape
    records = group['records']
    size, pages = model['page_size'], group['pages']
    start = (page - 1) * size
    navigation = '<nav class="pagination" aria-label="用例分页"><small>' + (f'第 {start + 1}–{min(page * size, len(records))} 条 / 共 {len(records)} 条' if records else '暂无逐条明细') + f' · 第 {page}/{pages} 页</small><div class="page-links">'
    # Bound the navigation DOM even for very large runs, while keeping every page reachable.
    numbers = sorted({1, pages, *range(max(1, page - 2), min(pages, page + 2) + 1)})
    previous = 0
    if page > 1:
        navigation += f'<a href="scene-{group["id"]}-{page - 1}.html" aria-label="上一页">上一页</a>'
    for number in numbers:
        if number > previous + 1:
            navigation += '<span aria-hidden="true">…</span>'
        navigation += f'<strong aria-current="page">第 {number} 页</strong>' if number == page else f'<a href="scene-{group["id"]}-{number}.html">第 {number} 页</a>'
        previous = number
    if page < pages:
        navigation += f'<a href="scene-{group["id"]}-{page + 1}.html" aria-label="下一页">下一页</a>'
    navigation += '</div></nav>'
    rows = []
    for record in records[start:start + size]:
        case, task = record['case'], record['task']
        detail = case.get('detail') or ''
        details = f'<details><summary>查看详情 / 错误日志</summary><pre>{escape(detail)}</pre></details>' if detail else ''
        rows.append(f'<tr class="case-row" id="{record["id"]}"><td>{report_badge(case.get("status", ""))}</td><td><a class="case-name" href="#{record["id"]}">{escape(case.get("name") or "未命名用例")}</a><small class="mono">{escape(case.get("file") or "文件未提供")}</small>{details}</td><td>{escape(task.get("framework") or "—")}</td><td>{report_duration(case.get("duration_seconds"), 3)}</td><td>{report_log_link(task, "../")}</td></tr>')
    counts = {state: sum(record['case'].get('status') == state for record in records) for state in ('PASS','FAIL','SKIP','NOT_RUN')}
    unknown = [task for task in group['tasks'] if not task.get('cases')]
    body = f'<div class="hero"><div><div class="eyebrow">场景明细 / 第 {page} 页</div><h1>{escape(group["label"])}</h1><p class="muted">共 {len(records)} 条明细；通过 {counts["PASS"]}，失败 {counts["FAIL"]}，跳过 {counts["SKIP"]}，未执行 {counts["NOT_RUN"]}。</p></div><a href="../report.html">返回总览</a></div>'
    body += report_search() + '<section class="panel"><div class="panel-head"><h2>用例结果</h2><small>每页最多 ' + str(size) + ' 条</small></div>' + navigation
    body += '<div class="table-wrap"><table class="case-table"><thead><tr><th>状态</th><th>用例与详情</th><th>框架</th><th>耗时</th><th>执行证据</th></tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>' + ('' if rows else '<div class="empty">当前场景未提供逐条用例，请查看下方任务日志。</div>') + navigation + '</section>'
    body += '<section class="panel"><div class="panel-head"><h2>未提供逐条明细的任务</h2><small>不计作单条用例</small></div>'
    if unknown:
        body += '<ul class="failure-list">' + ''.join(f'<li>{report_badge(task.get("status", ""))} <strong>{escape(task.get("label") or "未命名任务")}</strong><p>逐条用例未统计，请查看任务日志。{escape("；".join(task.get("failed_tests") or []))}</p>{report_log_link(task, "../")}</li>' for task in unknown) + '</ul>'
    else:
        body += '<div class="empty">无</div>'
    return report_shell(payload, model, body + '</section>', title=f'{group["label"]} · 第 {page} 页', active=scene, prefix='../', subtitle=group['label'])


def write_html_report(run_dir: Path, page_size: int = 50) -> Path:
    if page_size < 1:
        raise ValueError("每页用例数必须大于零")
    payload = json.loads((run_dir / 'details/report.json').read_text(encoding='utf-8'))
    if 'coverageTargets' not in payload:
        payload['coverageTargets'] = json.loads(COVERAGE_TARGETS.read_text(encoding='utf-8'))
    model = report_model(payload, page_size)
    assets = run_dir / 'assets'
    assets.mkdir(exist_ok=True)
    for name in ('report.css', 'report.js'):
        (assets / name).write_bytes((REPOSITORY_ROOT / 'tests/report_assets' / name).read_bytes())
    index = [{"name": record['case'].get('name') or '', "status": record['case'].get('status') or '',
              "file": record['case'].get('file') or '', "framework": record['task'].get('framework') or '',
              "scene": record['scene'], "detail": (record['case'].get('detail') or '')[:4000], "href": record['href']} for record in model['records']]
    (assets / 'case-index.js').write_text('globalThis.KC_REPORT_CASES = ' + json.dumps(index, ensure_ascii=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029') + ';\n', encoding='utf-8')
    pages_dir = run_dir / 'scenes'
    pages_dir.mkdir(exist_ok=True)
    for scene, group in model['scenes'].items():
        for page in range(1, group['pages'] + 1):
            (pages_dir / f'scene-{group["id"]}-{page}.html').write_text(report_scene_page(payload, model, scene, group, page), encoding='utf-8')
    target = run_dir / 'report.html'
    target.write_text(render_html_report(payload, model), encoding='utf-8')
    return target


def write_report(path: Path, command: str, results: list[TaskResult], elapsed: float) -> None:
    report = report_payload(command, results, elapsed)
    target = path if path.is_absolute() else REPOSITORY_ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"测试报告：{target}")


def write_execution_log(path: Path, command: str, results: list[TaskResult], elapsed: float) -> None:
    """追加一条 JSONL 执行日志，便于按命令和失败用例回查历史运行。"""
    target = path if path.is_absolute() else REPOSITORY_ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "command": command,
        "durationSeconds": round(elapsed, 3),
        "passed": all(result.status in {"PASS", "DRY-RUN"} for result in results),
        "tasks": [
            {
                "suite": result.suite,
                "label": result.label,
                "framework": result.framework,
                "command": result.command,
                "status": result.status,
                "returnCode": result.return_code,
                "durationSeconds": round(result.duration_seconds, 3),
                "failedTests": list(result.failed_tests),
            }
            for result in results
        ],
        "failedTests": [
            {"task": result.label, "test": failure}
            for result in results
            for failure in result.failed_tests
        ],
    }
    with target.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"测试日志：{target}")


def coverage_meets_target(counts: dict[str, dict[str, int]], target: dict[str, int]) -> bool:
    return all(
        counts[name]["total"] > 0 and counts[name]["covered"] * 100 >= counts[name]["total"] * target[name]
        for name in ("lines", "branches")
    )


def coverage_gate_status(runtime_metrics: dict[str, dict[str, Any]], targets: dict[str, dict[str, int]], test_exit_code: int) -> tuple[str, list[str]]:
    shortfalls = []
    for runtime_name, target in targets.items():
        runtime = runtime_metrics.get(runtime_name)
        if not runtime:
            shortfalls.append(f"{runtime_name} 缺少覆盖率报告")
            continue
        for metric_name in ("lines", "branches"):
            measured = runtime["summary"][metric_name]
            if measured["total"] <= 0 or measured["covered"] * 100 < measured["total"] * target[metric_name]:
                shortfalls.append(f"{runtime_name} {metric_name} {measured['covered']}/{measured['total']}（目标 {target[metric_name]}%）")
    return ("PASS" if test_exit_code == 0 and not shortfalls else "FAIL", shortfalls)


def run_frontend_coverage(coverage_dir: Path, log_path: Path, timeout: int) -> tuple[dict[str, Any] | None, str]:
    output_dir = coverage_dir / "frontend"
    command = ["node", str(REPOSITORY_ROOT / "tools" / "repository" / "collect-frontend-istanbul-coverage.cjs")]
    env = test_environment()
    env["KC_FRONTEND_ISTANBUL_OUTPUT"] = str(output_dir)
    try:
        completed = subprocess.run(
            command, cwd=REPOSITORY_ROOT, env=env, timeout=timeout, check=False,
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        log_path.write_text(f"命令：{shlex.join(command)}\n\n{completed.stdout}", encoding="utf-8")
    except (OSError, subprocess.TimeoutExpired) as error:
        log_path.write_text(f"命令：{shlex.join(command)}\n\n{error}\n", encoding="utf-8")
        return None, str(error)
    summary_path = output_dir / "coverage-summary.json"
    if completed.returncode != 0 or not summary_path.is_file():
        return None, f"前端覆盖率采集退出码 {completed.returncode}，详见 {log_path}"
    raw = json.loads(summary_path.read_text(encoding="utf-8"))
    return {"summary": raw["total"], "source_files": len(raw) - 1}, ""


def run_java_coverage(coverage_dir: Path, log_path: Path, timeout: int) -> tuple[dict[str, Any] | None, str]:
    output_dir = coverage_dir / "java"
    command = [sys.executable, str(REPOSITORY_ROOT / "tools" / "repository" / "collect-java-coverage.py")]
    env = test_environment()
    env["KC_JAVA_COVERAGE_OUTPUT"] = str(output_dir)
    try:
        completed = subprocess.run(
            command, cwd=REPOSITORY_ROOT, env=env, timeout=timeout, check=False,
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        log_path.write_text(f"命令：{shlex.join(command)}\n\n{completed.stdout}", encoding="utf-8")
    except (OSError, subprocess.TimeoutExpired) as error:
        log_path.write_text(f"命令：{shlex.join(command)}\n\n{error}\n", encoding="utf-8")
        return None, str(error)
    summary_path = output_dir / "coverage-summary.json"
    if completed.returncode != 0 or not summary_path.is_file():
        return None, f"Java 覆盖率采集退出码 {completed.returncode}，详见 {log_path}"
    raw = json.loads(summary_path.read_text(encoding="utf-8"))
    return {"summary": raw, "source_files": raw["sourceFiles"]}, ""


def run_jest_coverage(tasks: list[TestTask], context: RunContext, timeout: int) -> CoverageSummary:
    jest_files = sorted({path for task in tasks if task.framework == "jest" for path in task.files})
    coverage_dir = context.details_dir / "coverage"
    log_path = context.tasks_dir / "coverage-jest.log"
    if not jest_files:
        return CoverageSummary("FAIL", "Node 产品源码（含未执行文件）", {}, diagnostic="没有可采集的 Jest 测试")
    command = [
        *node_tool("jest"), "--config", relative(JEST_COVERAGE_CONFIG), "--runInBand", "--coverage",
        # 传入的是已经由统一入口判定为 Jest 的精确文件列表。若缺少该参数，
        # Jest 会把路径当作正则并再次扫描同目录，把 node:test/独立脚本误收集进来。
        "--runTestsByPath",
        "--coverageDirectory", str(coverage_dir),
        "--coverageReporters=json-summary", "--coverageReporters=lcov", "--coverageReporters=html",
        # coverageReporters 是数组参数；用 -- 明确终止选项解析，避免最后一个
        # reporter 把测试路径当成额外 reporter。绝对路径同时满足 runTestsByPath。
        "--", *[str(path) for path in jest_files],
    ]
    command_text = shlex.join(command)
    try:
        completed = subprocess.run(
            command,
            cwd=REPOSITORY_ROOT,
            env=test_environment(run_context=context),
            timeout=timeout,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        log_path.write_text(f"命令：{command_text}\n\n{completed.stdout}", encoding="utf-8")
    except (OSError, subprocess.TimeoutExpired) as error:
        log_path.write_text(f"命令：{command_text}\n\n{error}\n", encoding="utf-8")
        return CoverageSummary("FAIL", "Node 产品源码（含未执行文件）", {}, diagnostic=str(error))
    summary_path = coverage_dir / "coverage-summary.json"
    if not summary_path.is_file():
        return CoverageSummary(
            "FAIL", "Node 产品源码（含未执行文件）", {},
            diagnostic=f"Jest coverage 退出码 {completed.returncode}，详见 details/tasks/coverage-jest.log",
        )
    raw = json.loads(summary_path.read_text(encoding="utf-8"))
    total = raw.get("total", {})
    node_counts = {
        name: {
            "covered": int(total.get(name, {}).get("covered", 0)),
            "total": int(total.get(name, {}).get("total", 0)),
        }
        for name in ("lines", "branches")
    }
    frontend, frontend_error = run_frontend_coverage(coverage_dir, context.tasks_dir / "coverage-frontend.log", timeout)
    java, java_error = run_java_coverage(coverage_dir, context.tasks_dir / "coverage-java.log", timeout)
    runtime_metrics: dict[str, dict[str, Any]] = {"node": {"summary": total, "source_files": len(raw) - 1}}
    if frontend:
        runtime_metrics["frontend"] = frontend
    if java:
        runtime_metrics["java"] = java
    combined_counts = {
        name: {
            "covered": sum(int(runtime["summary"][name]["covered"]) for runtime in runtime_metrics.values()),
            "total": sum(int(runtime["summary"][name]["total"]) for runtime in runtime_metrics.values()),
        }
        for name in ("lines", "branches")
    }
    metrics = {
        name: round(combined_counts[name]["covered"] * 100 / combined_counts[name]["total"], 2) if combined_counts[name]["total"] else 0.0
        for name in ("lines", "branches")
    }
    metrics.update({name: float(total.get(name, {}).get("pct", 0.0)) for name in ("statements", "functions")})
    targets = json.loads(COVERAGE_TARGETS.read_text(encoding="utf-8"))
    status, shortfalls = coverage_gate_status(runtime_metrics, targets, completed.returncode)
    diagnostic = ""
    if completed.returncode != 0:
        diagnostic = f"Jest 用例退出码 {completed.returncode}，详见 details/tasks/coverage-jest.log"
    if frontend_error:
        diagnostic = f"{diagnostic}；" if diagnostic else ""
        diagnostic += frontend_error
    if java_error:
        diagnostic = f"{diagnostic}；" if diagnostic else ""
        diagnostic += java_error
    if shortfalls:
        diagnostic = f"{diagnostic}；" if diagnostic else ""
        diagnostic += f"覆盖率未达标：{', '.join(shortfalls)}"
    lowest = []
    for file_name, values in raw.items():
        if file_name == "total":
            continue
        lowest.append((Path(file_name).name, float(values.get("lines", {}).get("pct", 0.0))))
    return CoverageSummary(
        status, "知识中心管理平台 Node、浏览器脚本和 Java 存储", metrics,
        tuple(sorted(lowest, key=lambda item: (item[1], item[0]))[:10]),
        diagnostic=diagnostic,
        source_files=sum(item["source_files"] for item in runtime_metrics.values()),
        counts=combined_counts,
        runtime_metrics=runtime_metrics,
    )


def report_status(results: list[TaskResult], coverage: CoverageSummary | None = None) -> str:
    statuses = {result.status for result in results}
    if "INTERRUPTED" in statuses:
        return "已中断"
    if "TIMEOUT" in statuses:
        return "超时"
    if any(status not in {"PASS", "DRY-RUN"} for status in statuses):
        return "失败"
    if coverage and coverage.status != "PASS":
        return "失败"
    return "通过"


def coverage_succeeded(coverage: CoverageSummary | None, *, dry_run: bool) -> bool:
    if coverage is None or coverage.status == "PASS":
        return True
    return dry_run and coverage.status == "NOT_RUN"


def write_markdown_report(
    context: RunContext,
    results: list[TaskResult],
    elapsed: float,
    coverage: CoverageSummary | None,
    generated_at: datetime,
) -> None:
    status = report_status(results, coverage)
    succeeded = sum(result.status in {"PASS", "DRY-RUN"} for result in results)
    failures = [(result, failure) for result in results for failure in result.failed_tests]
    totals = [result.test_total for result in results if result.test_total is not None]
    passed_tests = sum(result.test_passed or 0 for result in results)
    failed_tests = sum(result.test_failed or 0 for result in results)
    skipped_tests = sum(result.test_skipped or 0 for result in results)
    lines = [
        f"# {context.command} 测试报告",
        "",
        "## 最终结论",
        "",
        f"**{status}**",
        "",
        "## 核心数字",
        "",
        "| 指标 | 结果 |",
        "|---|---:|",
        f"| 任务 | {succeeded}/{len(results)} 成功 |",
        f"| 测试文件 | {sum(result.file_count for result in results)} |",
        f"| 已识别测试用例 | {sum(totals) if totals else '未统计'} |",
        f"| 用例结果 | 通过 {passed_tests} / 失败 {failed_tests} / 跳过 {skipped_tests} |",
        f"| 总耗时 | {elapsed:.2f} 秒 |",
        f"| 生成时间 | {generated_at.isoformat(timespec='seconds')} |",
        "",
        "## 失败与阻塞",
        "",
    ]
    if failures:
        for result, failure in failures:
            log_link = result.log_file
            suffix = f"（[任务日志](./{log_link})）" if log_link else ""
            lines.append(f"- **{result.label}**：{failure}{suffix}")
    else:
        lines.append("无失败或阻塞。")
    lines.extend(["", "## 代码覆盖率", ""])
    if coverage:
        if coverage.metrics:
            lines.extend([
                f"> 范围：{coverage.scope}，源文件 {coverage.source_files} 个。Node、浏览器和 Java 分别采集并独立判定目标。",
                "",
                "| Node 语句 | 全平台分支 | Node 函数 | 全平台行 |",
                "|---:|---:|---:|---:|",
                f"| {coverage.metrics['statements']:.2f}% | {coverage.metrics['branches']:.2f}% | {coverage.metrics['functions']:.2f}% | {coverage.metrics['lines']:.2f}% |",
                "",
                f"计数：行 {coverage.counts['lines']['covered']}/{coverage.counts['lines']['total']}，分支 {coverage.counts['branches']['covered']}/{coverage.counts['branches']['total']}。" if coverage.counts else "",
                *[
                    f"{name}：源文件 {item['source_files']} 个，行 {item['summary']['lines']['covered']}/{item['summary']['lines']['total']}，分支 {item['summary']['branches']['covered']}/{item['summary']['branches']['total']}。"
                    for name, item in (coverage.runtime_metrics or {}).items()
                ],
                "",
                "覆盖率较低的文件（按行覆盖率）：",
                "",
                *[f"- `{name}`：{percent:.2f}%" for name, percent in coverage.lowest_files],
                "",
                "完整报告：[details/coverage/lcov-report/index.html](./details/coverage/lcov-report/index.html)",
            ])
            if coverage.status != "PASS":
                lines.extend(["", f"未通过：{coverage.diagnostic}"])
        else:
            lines.append(f"采集失败：{coverage.diagnostic}")
    else:
        lines.append("本次未启用 `--coverage`，不输出推测性覆盖率。")
    lines.extend([
        "", "## 分类结果", "",
        "| 状态 | 分类 | 框架 | 文件 | 用例 | 耗时 | 明细 |",
        "|---|---|---|---:|---:|---:|---|",
    ])
    for result in results:
        log_link = result.log_file
        detail = f"[日志](./{log_link})" if log_link else "-"
        lines.append(
            f"| {result.status} | {result.suite} | {result.framework} | {result.file_count} | "
            f"{result.test_total if result.test_total is not None else '-'} | {result.duration_seconds:.2f}s | {detail} |"
        )
    lines.extend([
        "", "## 环境与证据", "",
        f"- 运行标识：`{context.run_id}`",
        f"- 机器可读报告：[details/report.json](./details/report.json)",
        f"- 执行记录：[details/execution.log](./details/execution.log)",
    ])
    if context.artifact_dir.is_dir():
        lines.append("- 浏览器证据：`details/artifacts/`")
    (context.run_dir / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_index() -> None:
    reports = []
    for report_path in TEST_REPORT_ROOT.glob("????-??-??/*/details/report.json"):
        try:
            payload = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        reports.append((payload.get("generatedAt", ""), report_path, payload))
    lines = [
        "# 测试报告索引", "",
        "正式归档仅包含 `gate`、`full/all`。重要结论位于每次运行的 `report.md`，技术明细下沉至 `details/`。",
        "", "| 时间 | 命令 | 结论 | 耗时 | 覆盖率 | 报告 |", "|---|---|---|---:|---|---|",
    ]
    for generated_at, report_path, payload in sorted(reports, reverse=True)[:30]:
        coverage = payload.get("coverage")
        coverage_text = "已采集" if coverage and coverage.get("status") == "PASS" else "未采集"
        status = "通过" if payload.get("passed") else "失败"
        report_md = report_path.parent.parent / "report.md"
        link = report_md.relative_to(TEST_REPORT_ROOT).as_posix()
        lines.append(
            f"| {generated_at} | {payload.get('command', '-')} | {status} | "
            f"{payload.get('durationSeconds', 0):.2f}s | {coverage_text} | [查看](./{link}) |"
        )
    TEST_REPORT_ROOT.mkdir(parents=True, exist_ok=True)
    (TEST_REPORT_ROOT / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def finalize_formal_report(
    context: RunContext,
    results: list[TaskResult],
    elapsed: float,
    coverage: CoverageSummary | None,
    generated_at: datetime,
) -> dict[str, Any]:
    payload = report_payload(context.command, results, elapsed, coverage, generated_at)
    (context.details_dir / "report.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    execution_entry = {
        "generatedAt": payload["generatedAt"],
        "command": context.command,
        "passed": payload["passed"],
        "durationSeconds": payload["durationSeconds"],
        "tasks": [
            {
                "label": result.label,
                "command": result.command,
                "status": result.status,
                "returnCode": result.return_code,
                "logFile": result.log_file,
                "failedTests": list(result.failed_tests),
            }
            for result in results
        ],
    }
    (context.details_dir / "execution.log").write_text(
        json.dumps(execution_entry, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    write_markdown_report(context, results, elapsed, coverage, generated_at)
    write_index()
    print(f"正式测试报告：{context.run_dir / 'report.md'}")
    return payload


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="仓库统一测试入口：按分类执行并汇总 Jest、unittest 和 Playwright 结果。"
    )
    parser.add_argument(
        "command",
        choices=("list", "smoke", "gate", "unit", "contract", "integration", "system", "e2e", "full", "all"),
        help="测试分类；all 是 full 的兼容别名",
    )
    parser.add_argument("--dry-run", action="store_true", help="只展示将执行的命令和文件")
    parser.add_argument("--report-page-size", type=int, default=50, help="HTML 场景每页用例数，默认 50")
    parser.add_argument("--fail-fast", action="store_true", help="任一测试任务失败后停止")
    parser.add_argument(
        "--jobs", type=int,
        default=min(4, os.cpu_count() or 1),
        help="资源安全任务的最大并发数，默认 min(4, CPU 数)",
    )
    parser.add_argument("--timeout", type=int, default=1800, help="每个测试任务的超时秒数，默认 1800")
    parser.add_argument("--coverage", action="store_true", help="仅 full/all 启用 Jest JavaScript 覆盖率采集")
    parser.add_argument("--report", type=Path, help="兼容导出 JSON 汇总报告路径；正式报告仍写入 runtime/")
    parser.add_argument("--log", type=Path, help="兼容导出执行日志路径；正式明细仍写入本次运行目录")
    args = parser.parse_args(argv)
    if args.report_page_size <= 0:
        parser.error("--report-page-size 必须大于 0")
    if args.timeout <= 0:
        parser.error("--timeout 必须大于 0")
    if args.jobs <= 0:
        parser.error("--jobs 必须大于 0")
    if args.coverage and args.command not in {"full", "all"}:
        parser.error("--coverage 仅支持 full/all")
    for option_name in ("report", "log"):
        option_path = getattr(args, option_name)
        if option_path:
            resolved_parent = (REPOSITORY_ROOT / option_path).resolve().parent if not option_path.is_absolute() else option_path.resolve().parent
            if resolved_parent == TEST_REPORT_ROOT.resolve():
                parser.error(f"--{option_name} 不能直接写入 runtime/test-reports 根目录，请指定具体运行目录或 runtime/test-results")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    if args.command == "list":
        print_catalog()
        return 0

    try:
        tasks = build_tasks(args.command)
    except RuntimeError as error:
        print(f"测试入口配置错误：{error}", file=sys.stderr)
        return 2
    if not tasks:
        print(f"分类 {args.command} 没有发现测试用例，按失败处理。", file=sys.stderr)
        return 2

    started = time.monotonic()
    generated_at = datetime.now().astimezone()
    context = create_run_context(args.command, generated_at, formal_override=False if args.dry_run else None)
    results: list[TaskResult] = []
    coverage = None
    knowledge_center_lease = None
    preflight_executor = None
    preflight_future = None
    has_playwright = any(task.framework == "playwright" for task in tasks)
    playwright_ready = args.dry_run or not has_playwright
    if has_playwright and not args.dry_run and not args.fail_fast:
        preflight_executor = ThreadPoolExecutor(max_workers=1)
        preflight_future = preflight_executor.submit(ensure_knowledge_center, context)
        print("Playwright 前置条件：已后台准备，先执行不依赖浏览器服务的测试。")
    elif not playwright_ready:
        playwright_ready, knowledge_center_lease, diagnostic = ensure_knowledge_center(context)
        print(f"Playwright 前置条件：{diagnostic}")
        if not playwright_ready:
            results.append(TaskResult("preflight", "Playwright / 知识中心服务", "preflight", "FAIL", 0.0, 1, 0, (diagnostic,), ""))
    try:
        runnable = [
            (index, task)
            for index, task in enumerate(tasks, 1)
            if not (task.framework == "playwright" and not playwright_ready and preflight_future is None)
        ]
        task_results: dict[int, TaskResult] = {}

        def run_one(index: int, task: TestTask, *, emit_output: bool = True) -> TaskResult:
            log_path = context.tasks_dir / f"{task_slug(index, task)}.log"
            try:
                return run_task(
                    task,
                    dry_run=args.dry_run,
                    timeout=args.timeout,
                    run_context=context,
                    knowledge_center_base_url=(knowledge_center_lease.base_url if knowledge_center_lease else None),
                    knowledge_center_test_run_id=(context.run_id if knowledge_center_lease else None),
                    knowledge_center_storage_url=(knowledge_center_lease.environment["YASDB_STORAGE_URL"] if knowledge_center_lease else None),
                    log_path=log_path,
                    jobs=args.jobs,
                    emit_output=emit_output,
                )
            except Exception as error:
                command_text = shlex.join(task_command(task, args.jobs))
                diagnostic = f"统一测试调度异常：{error}"
                try:
                    log_path.write_text(f"命令：{command_text}\n\n{diagnostic}\n", encoding="utf-8")
                except OSError:
                    pass
                return TaskResult(
                    task.suite, task.label, task.framework, "FAIL", 0.0, 1,
                    len(task.files), (diagnostic,), command_text,
                    log_file=log_path.relative_to(context.run_dir).as_posix(),
                )

        def show_parallel_results(batch: list[tuple[int, TestTask]], batch_results: list[TaskResult]) -> None:
            for (index, task), result in zip(batch, batch_results):
                print(f"\n{'=' * 72}")
                print(f"完成：{task.label} [{result.status}]，耗时 {result.duration_seconds:.2f}s")
                log_path = context.run_dir / result.log_file if result.log_file else None
                if log_path and log_path.is_file():
                    print(log_path.read_text(encoding="utf-8"), end="")

        def run_serial(sequence: list[tuple[int, TestTask]]) -> None:
            for index, task in sequence:
                result = run_one(index, task)
                task_results[index] = result
                if result.status not in {"PASS", "DRY-RUN"} and args.fail_fast:
                    break

        def schedule(sequence: list[tuple[int, TestTask]]) -> None:
            # Keep semantic suites ordered. Within a suite, only explicitly
            # isolated channels are parallel; all shared/database state stays
            # serialized and therefore retains the existing safety boundary.
            for suite in dict.fromkeys(task.suite for _, task in sequence):
                suite_tasks = [(index, task) for index, task in sequence if task.suite == suite]
                for resource, limit in (
                    ("isolated-cpu", args.jobs),
                    ("isolated-io", min(2, args.jobs)),
                    ("service-read", min(2, args.jobs)),
                ):
                    batch = [(index, task) for index, task in suite_tasks if task_resource(task) == resource]
                    if not batch:
                        continue
                    # A Jest task may itself use --maxWorkers. Run it separately
                    # so its worker pool cannot oversubscribe the outer process cap.
                    if resource == "isolated-cpu":
                        jest_batch = [(index, task) for index, task in batch if task.framework == "jest"]
                        other_batch = [(index, task) for index, task in batch if task.framework != "jest"]
                        for item in jest_batch:
                            result = run_one(*item, emit_output=False)
                            task_results[item[0]] = result
                            show_parallel_results([item], [result])
                        batch = other_batch
                    if batch:
                        with ThreadPoolExecutor(max_workers=min(limit, len(batch))) as executor:
                            batch_results = list(executor.map(lambda item: run_one(*item, emit_output=False), batch))
                        task_results.update({index: result for (index, _), result in zip(batch, batch_results)})
                        show_parallel_results(batch, batch_results)
                run_serial([
                    item for item in suite_tasks
                    if task_resource(item[1]) in {"shared-state", "database-write", "performance"}
                ])

        if args.fail_fast or args.dry_run:
            run_serial(runnable)
        elif preflight_future:
            schedule([(index, task) for index, task in runnable if task.framework != "playwright"])
            playwright_ready, knowledge_center_lease, diagnostic = preflight_future.result()
            print(f"Playwright 前置条件：{diagnostic}")
            if playwright_ready:
                schedule([(index, task) for index, task in runnable if task.framework == "playwright"])
            else:
                results.append(TaskResult(
                    "preflight", "Playwright / 知识中心服务", "preflight", "FAIL",
                    0.0, 1, 0, (diagnostic,), "",
                ))
        else:
            schedule(runnable)
        results.extend(task_results[index] for index in sorted(task_results))
        if not args.dry_run:
            results.extend(TaskResult(task.suite, task.label, task.framework, "NOT_RUN", 0.0, 0,
                                      len(task.files), ("因前置失败或快速失败策略未执行",))
                           for index, task in enumerate(tasks, 1) if index not in task_results)
        if args.coverage and not args.dry_run:
            coverage = run_jest_coverage(tasks, context, args.timeout)
            if coverage.status != "PASS":
                print(f"覆盖率采集失败：{coverage.diagnostic}", file=sys.stderr)
        elif args.coverage:
            coverage = CoverageSummary("NOT_RUN", "Node 产品源码（含未执行文件）", {}, diagnostic="dry-run 未执行")
    finally:
        if preflight_executor:
            preflight_executor.shutdown(wait=True)
        if knowledge_center_lease:
            if not stop_owned_knowledge_center(knowledge_center_lease):
                print("警告：测试实例所有权或进程身份已变化，拒绝自动停止，请根据本次报告手工处置。", file=sys.stderr)
            release_e2e_database_lock(knowledge_center_lease.database_lock)
    elapsed = time.monotonic() - started

    print_summary(results, elapsed)
    if context.formal and not args.dry_run:
        finalize_formal_report(context, results, elapsed, coverage, generated_at)
    elif not args.dry_run:
        payload = report_payload(context.command, results, elapsed, coverage, generated_at)
        (context.details_dir / "report.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (context.run_dir / "report.md").write_text(
            f"# {context.command} 测试报告\n\n最终结论：**{report_status(results, coverage)}**\n\n详细任务日志位于 `details/tasks/`。\n",
            encoding="utf-8",
        )
    if not args.dry_run:
        html_path = write_html_report(context.run_dir, args.report_page_size)
        print(f"HTML 测试报告：{html_path}")
    if args.report:
        write_report(args.report, args.command, results, elapsed)
    if args.log:
        write_execution_log(args.log, args.command, results, elapsed)
    return 0 if all(result.status in {"PASS", "DRY-RUN"} for result in results) and coverage_succeeded(coverage, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
