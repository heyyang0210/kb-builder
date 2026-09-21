#!/usr/bin/env python3
"""YashanDB 知识库仓库统一测试入口。

用例按文件命名自动归类，再交给 Jest、Node、unittest、pytest、Python
或 Playwright 执行，以便保留各 runner 逐条用例的成功/失败输出。
"""

from __future__ import annotations

import argparse
import ast
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
PLAYWRIGHT_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "playwright.config.js"
TEST_REPORT_ROOT = REPOSITORY_ROOT / "runtime" / "test-reports"
TEST_RESULT_ROOT = REPOSITORY_ROOT / "runtime" / "test-results"
TEST_DATABASE_CONFIG_DIR = REPOSITORY_ROOT / "runtime" / "test-config" / "yashandb"
KNOWLEDGE_CENTER_SCRIPT = REPOSITORY_ROOT / "knowledge-center.sh"
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


@dataclass(frozen=True)
class KnowledgeCenterLease:
    owner: str
    base_url: str
    health_url: str
    environment: dict[str, str]
    state_dir: Path
    process_identities: dict[str, tuple[int, str]]


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
    if "contract" in name or "compatibility" in name:
        return "contract"
    if "integration" in name:
        return "integration"
    if "system" in name or "performance" in name or (framework == "jest" and "e2e" in name):
        return "system"
    if framework == "playwright":
        return "e2e"
    return "unit"


def classify_node_runner(path: Path) -> str:
    """Jest 文件包含用例声明，否则按独立 Node 脚本执行。"""
    source = path.read_text(encoding="utf-8")
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


def make_task(suite: str, framework: str, files: Iterable[Path]) -> TestTask | None:
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
            if framework in {"node-script", "python-script", "unittest", "pytest"}:
                tasks.extend(make_task(suite, framework, (path,)) for path in files)
            else:
                task = make_task(suite, framework, files)
                if task:
                    tasks.append(task)
    return tasks


def task_command(task: TestTask) -> list[str]:
    files = [relative(path) for path in task.files]
    if task.framework == "jest":
        return [
            *node_tool("jest"),
            "--config", relative(JEST_CONFIG),
            "--runInBand", "--verbose", *files,
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
    env["KPG_BASE_URL"] = knowledge_center_base_url or env.get("KPG_BASE_URL", KNOWLEDGE_CENTER_BASE_URL)
    if knowledge_center_test_run_id:
        env["KNOWLEDGE_CENTER_TEST_RUN_ID"] = knowledge_center_test_run_id
    if run_context:
        env["YASDB_TEST_RUN_DIR"] = str(run_context.run_dir)
        env["YASDB_TEST_ARTIFACT_DIR"] = str(run_context.artifact_dir)
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
        "YASDB_CONFIG_DIR": str(TEST_DATABASE_CONFIG_DIR),
        "KNOWLEDGE_STORAGE_MODE": "database",
        "KNOWLEDGE_CENTER_AUTH_STORE": str(service_root / "data" / "auth.json"),
        "INCREMENTAL_BUILD_STATE": str(service_root / "data" / "incremental-build-state.json"),
    })
    base_url = f"http://127.0.0.1:{frontend}"
    return env, base_url, owner


def ensure_knowledge_center(context: RunContext) -> tuple[bool, KnowledgeCenterLease | None, str]:
    """Always start an owned instance backed by the dedicated test schema."""
    if not KNOWLEDGE_CENTER_SCRIPT.is_file():
        return False, None, f"缺少启动脚本：{KNOWLEDGE_CENTER_SCRIPT}"
    try:
        env, base_url, owner = isolated_knowledge_center_environment(context)
    except RuntimeError as error:
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
            lease = KnowledgeCenterLease(owner, base_url, health_url, env, state_dir, read_lease_processes(state_dir))
            if len(lease.process_identities) != 4:
                return False, lease, "独立测试实例缺少完整进程所有权证据"
            return True, lease, "统一入口已启动 test_hy Schema 隔离的知识中心测试实例"
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
    log_path: Path | None = None,
) -> TaskResult:
    command = task_command(task)
    command_text = shlex.join(command)
    print(f"\n{'=' * 72}")
    print(f"执行：{task.label}（{len(task.files)} 个测试文件）")
    print(f"命令：{command_text}")
    print("-" * 72, flush=True)

    if dry_run:
        output = "\n".join([f"命令：{command_text}", *(f"文件：{relative(path)}" for path in task.files)]) + "\n"
        if log_path:
            log_path.write_text(output, encoding="utf-8")
        for path in task.files:
            print(f"  - {relative(path)}")
        return TaskResult(
            task.suite, task.label, task.framework, "DRY-RUN", 0.0, 0, len(task.files),
            command=command_text,
            log_file=(log_path.relative_to(run_context.run_dir).as_posix() if log_path and run_context else str(log_path or "")),
        )

    started = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            cwd=REPOSITORY_ROOT,
            env=test_environment(task, run_context, knowledge_center_base_url, knowledge_center_test_run_id),
            timeout=timeout,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        print(completed.stdout, end="" if completed.stdout.endswith("\n") else "\n")
        if log_path:
            log_path.write_text(
                f"命令：{command_text}\n\n{completed.stdout}",
                encoding="utf-8",
            )
        return_code = completed.returncode
        if return_code == 0 and framework_reported_zero_tests(task.framework, completed.stdout):
            print("底层框架未收集到任何用例，按失败处理。", file=sys.stderr)
            return_code = 5
        status = "PASS" if return_code == 0 else "FAIL"
        failed_tests = extract_failed_tests(task.framework, completed.stdout)
        if return_code == 5 and not failed_tests:
            failed_tests = ("未收集到测试用例",)
        test_total, test_passed, test_failed, test_skipped = extract_test_counts(task.framework, completed.stdout)
    except FileNotFoundError as error:
        print(f"无法启动测试命令：{error}", file=sys.stderr)
        return_code = 127
        status = "FAIL"
        failed_tests = (str(error),)
        test_total = test_passed = test_failed = test_skipped = None
        if log_path:
            log_path.write_text(f"命令：{command_text}\n\n{error}\n", encoding="utf-8")
    except subprocess.TimeoutExpired:
        print(f"测试执行超过 {timeout} 秒，已终止。", file=sys.stderr)
        return_code = 124
        status = "TIMEOUT"
        failed_tests = (f"任务超时：{task.label}",)
        test_total = test_passed = test_failed = test_skipped = None
        if log_path:
            log_path.write_text(f"命令：{command_text}\n\n任务超过 {timeout} 秒。\n", encoding="utf-8")
    except KeyboardInterrupt:
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
        failed_tests, command_text, test_total, test_passed, test_failed, test_skipped, log_file,
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
    return payload


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


def run_jest_coverage(tasks: list[TestTask], context: RunContext, timeout: int) -> CoverageSummary:
    jest_files = sorted({path for task in tasks if task.framework == "jest" for path in task.files})
    coverage_dir = context.details_dir / "coverage"
    log_path = context.tasks_dir / "coverage-jest.log"
    if not jest_files:
        return CoverageSummary("FAIL", "Jest 管理的 JavaScript 代码", {}, diagnostic="没有可采集的 Jest 测试")
    command = [
        *node_tool("jest"), "--config", relative(JEST_CONFIG), "--runInBand", "--coverage",
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
        return CoverageSummary("FAIL", "Jest 管理的 JavaScript 代码", {}, diagnostic=str(error))
    summary_path = coverage_dir / "coverage-summary.json"
    if completed.returncode != 0 or not summary_path.is_file():
        return CoverageSummary(
            "FAIL", "Jest 管理的 JavaScript 代码", {},
            diagnostic=f"Jest coverage 退出码 {completed.returncode}，详见 details/tasks/coverage-jest.log",
        )
    raw = json.loads(summary_path.read_text(encoding="utf-8"))
    total = raw.get("total", {})
    metrics = {
        name: float(total.get(name, {}).get("pct", 0.0))
        for name in ("statements", "branches", "functions", "lines")
    }
    lowest = []
    for file_name, values in raw.items():
        if file_name == "total":
            continue
        lowest.append((Path(file_name).name, float(values.get("lines", {}).get("pct", 0.0))))
    return CoverageSummary(
        "PASS", "Jest 管理的 JavaScript 代码", metrics,
        tuple(sorted(lowest, key=lambda item: (item[1], item[0]))[:10]),
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
        if coverage.status == "PASS":
            lines.extend([
                f"> 范围：{coverage.scope}。这不是全仓覆盖率；Python、独立 Node 脚本和 Playwright 未纳入。",
                "",
                "| 语句 | 分支 | 函数 | 行 |",
                "|---:|---:|---:|---:|",
                f"| {coverage.metrics['statements']:.2f}% | {coverage.metrics['branches']:.2f}% | {coverage.metrics['functions']:.2f}% | {coverage.metrics['lines']:.2f}% |",
                "",
                "覆盖率较低的文件（按行覆盖率）：",
                "",
                *[f"- `{name}`：{percent:.2f}%" for name, percent in coverage.lowest_files],
                "",
                "完整报告：[details/coverage/lcov-report/index.html](./details/coverage/lcov-report/index.html)",
            ])
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
    parser.add_argument("--fail-fast", action="store_true", help="任一测试任务失败后停止")
    parser.add_argument("--timeout", type=int, default=1800, help="每个测试任务的超时秒数，默认 1800")
    parser.add_argument("--coverage", action="store_true", help="仅 full/all 启用 Jest JavaScript 覆盖率采集")
    parser.add_argument("--report", type=Path, help="兼容导出 JSON 汇总报告路径；正式报告仍写入 runtime/")
    parser.add_argument("--log", type=Path, help="兼容导出执行日志路径；正式明细仍写入本次运行目录")
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout 必须大于 0")
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
    playwright_ready = args.dry_run or not any(task.framework == "playwright" for task in tasks)
    if not playwright_ready:
        playwright_ready, knowledge_center_lease, diagnostic = ensure_knowledge_center(context)
        print(f"Playwright 前置条件：{diagnostic}")
        if not playwright_ready:
            results.append(TaskResult("preflight", "Playwright / 知识中心服务", "preflight", "FAIL", 0.0, 1, 0, (diagnostic,), ""))
    try:
        for task in tasks:
            if task.framework == "playwright" and not playwright_ready:
                continue
            result = run_task(
                task,
                dry_run=args.dry_run,
                timeout=args.timeout,
                run_context=context,
                knowledge_center_base_url=(knowledge_center_lease.base_url if knowledge_center_lease else None),
                knowledge_center_test_run_id=(context.run_id if knowledge_center_lease else None),
                log_path=context.tasks_dir / f"{task_slug(len(results) + 1, task)}.log",
            )
            results.append(result)
            if args.fail_fast and result.status not in {"PASS", "DRY-RUN"}:
                break
        if args.coverage and not args.dry_run:
            coverage = run_jest_coverage(tasks, context, args.timeout)
            if coverage.status != "PASS":
                print(f"覆盖率采集失败：{coverage.diagnostic}", file=sys.stderr)
        elif args.coverage:
            coverage = CoverageSummary("NOT_RUN", "Jest 管理的 JavaScript 代码", {}, diagnostic="dry-run 未执行")
    finally:
        if knowledge_center_lease and not stop_owned_knowledge_center(knowledge_center_lease):
            print("警告：测试实例所有权或进程身份已变化，拒绝自动停止，请根据本次报告手工处置。", file=sys.stderr)
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
    if args.report:
        write_report(args.report, args.command, results, elapsed)
    if args.log:
        write_execution_log(args.log, args.command, results, elapsed)
    return 0 if all(result.status in {"PASS", "DRY-RUN"} for result in results) and coverage_succeeded(coverage, dry_run=args.dry_run) else 1


if __name__ == "__main__":
    raise SystemExit(main())
