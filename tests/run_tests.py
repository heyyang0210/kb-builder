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
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
NODE_TEST_ROOT = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner"
PYTHON_TEST_ROOT = REPOSITORY_ROOT / "tests" / "unit"
E2E_TEST_ROOT = REPOSITORY_ROOT / "tests" / "e2e" / "agent-runner"
JEST_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "jest.config.js"
PLAYWRIGHT_CONFIG = REPOSITORY_ROOT / "tests" / "unit" / "agent-runner" / "playwright.config.js"
KNOWLEDGE_CENTER_SCRIPT = REPOSITORY_ROOT / "knowledge-center.sh"
KNOWLEDGE_CENTER_HEALTH_URL = os.environ.get(
    "KPG_BASE_URL", "http://127.0.0.1:13510"
).rstrip("/") + "/knowledge-center/api/auth/config"

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


def relative(path: Path) -> str:
    return path.relative_to(REPOSITORY_ROOT).as_posix()


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
        return ["node", "--test", files[0]]
    if task.framework == "node-script":
        return ["node", files[0]]
    if task.framework == "unittest":
        return [python_executable(), "-m", "unittest", "-v", *files]
    if task.framework == "pytest":
        return [python_executable(), "-m", "pytest", "-v", *files]
    if task.framework == "python-script":
        return [python_executable(), files[0]]
    if task.framework == "playwright":
        return [
            *node_tool("playwright"), "test",
            "--config", relative(PLAYWRIGHT_CONFIG),
            "--reporter=list", *files,
        ]
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


def test_environment(task: TestTask | None = None) -> dict[str, str]:
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


def ensure_knowledge_center() -> tuple[bool, bool, str]:
    """Return ready, started_by_runner, diagnostic."""
    if http_ready(KNOWLEDGE_CENTER_HEALTH_URL):
        return True, False, "复用已运行的知识中心服务"
    if not KNOWLEDGE_CENTER_SCRIPT.is_file():
        return False, False, f"缺少启动脚本：{KNOWLEDGE_CENTER_SCRIPT}"
    last_output = ""
    for arguments in (("start", "--no-build"), ("start",)):
        completed = subprocess.run(
            [str(KNOWLEDGE_CENTER_SCRIPT), *arguments],
            cwd=REPOSITORY_ROOT,
            env=test_environment(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            check=False,
        )
        last_output = completed.stdout
        if completed.returncode == 0 and http_ready(KNOWLEDGE_CENTER_HEALTH_URL):
            return True, "已在运行" not in completed.stdout, "统一入口已准备知识中心测试服务"
        if "已有知识中心启停操作正在执行" in completed.stdout and wait_for_http(KNOWLEDGE_CENTER_HEALTH_URL, 60):
            return True, False, "复用并发启动完成的知识中心服务"
    return False, False, last_output.strip() or "知识中心服务启动失败"


def stop_owned_knowledge_center() -> None:
    subprocess.run(
        [str(KNOWLEDGE_CENTER_SCRIPT), "stop"],
        cwd=REPOSITORY_ROOT,
        env=test_environment(),
        check=False,
    )


def run_task(task: TestTask, *, dry_run: bool, timeout: int) -> TaskResult:
    command = task_command(task)
    print(f"\n{'=' * 72}")
    print(f"执行：{task.label}（{len(task.files)} 个测试文件）")
    print(f"命令：{shlex.join(command)}")
    print("-" * 72, flush=True)

    if dry_run:
        for path in task.files:
            print(f"  - {relative(path)}")
        return TaskResult(task.suite, task.label, task.framework, "DRY-RUN", 0.0, 0, len(task.files))

    started = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            cwd=REPOSITORY_ROOT,
            env=test_environment(task),
            timeout=timeout,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        print(completed.stdout, end="" if completed.stdout.endswith("\n") else "\n")
        return_code = completed.returncode
        if return_code == 0 and framework_reported_zero_tests(task.framework, completed.stdout):
            print("底层框架未收集到任何用例，按失败处理。", file=sys.stderr)
            return_code = 5
        status = "PASS" if return_code == 0 else "FAIL"
        failed_tests = extract_failed_tests(task.framework, completed.stdout)
        if return_code == 5 and not failed_tests:
            failed_tests = ("未收集到测试用例",)
    except FileNotFoundError as error:
        print(f"无法启动测试命令：{error}", file=sys.stderr)
        return_code = 127
        status = "FAIL"
        failed_tests = (str(error),)
    except subprocess.TimeoutExpired:
        print(f"测试执行超过 {timeout} 秒，已终止。", file=sys.stderr)
        return_code = 124
        status = "TIMEOUT"
        failed_tests = (f"任务超时：{task.label}",)
    except KeyboardInterrupt:
        print("测试执行被用户中断。", file=sys.stderr)
        return_code = 130
        status = "INTERRUPTED"
        failed_tests = (f"任务被中断：{task.label}",)
    duration = time.monotonic() - started
    return TaskResult(task.suite, task.label, task.framework, status, duration, return_code, len(task.files), failed_tests)


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


def write_report(path: Path, command: str, results: list[TaskResult], elapsed: float) -> None:
    report = {
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "command": command,
        "durationSeconds": round(elapsed, 3),
        "passed": all(result.status in {"PASS", "DRY-RUN"} for result in results),
        "tasks": [result.__dict__ for result in results],
    }
    target = path if path.is_absolute() else REPOSITORY_ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"测试报告：{target}")


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
    parser.add_argument("--report", type=Path, help="可选 JSON 汇总报告路径，建议写入 runtime/")
    args = parser.parse_args(argv)
    if args.timeout <= 0:
        parser.error("--timeout 必须大于 0")
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
    results: list[TaskResult] = []
    owns_knowledge_center = False
    playwright_ready = args.dry_run or not any(task.framework == "playwright" for task in tasks)
    if not playwright_ready:
        playwright_ready, owns_knowledge_center, diagnostic = ensure_knowledge_center()
        print(f"Playwright 前置条件：{diagnostic}")
        if not playwright_ready:
            results.append(TaskResult("preflight", "Playwright / 知识中心服务", "preflight", "FAIL", 0.0, 1, 0, (diagnostic,)))
    try:
        for task in tasks:
            if task.framework == "playwright" and not playwright_ready:
                continue
            result = run_task(task, dry_run=args.dry_run, timeout=args.timeout)
            results.append(result)
            if args.fail_fast and result.status not in {"PASS", "DRY-RUN"}:
                break
    finally:
        if owns_knowledge_center:
            stop_owned_knowledge_center()
    elapsed = time.monotonic() - started

    print_summary(results, elapsed)
    if args.report:
        write_report(args.report, args.command, results, elapsed)
    return 0 if all(result.status in {"PASS", "DRY-RUN"} for result in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
