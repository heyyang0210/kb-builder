import importlib.util
import glob
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = REPOSITORY_ROOT / "tests" / "run_tests.py"
SPEC = importlib.util.spec_from_file_location("repository_test_runner", RUNNER_PATH)
RUNNER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = RUNNER
SPEC.loader.exec_module(RUNNER)


class RepositoryTestRunnerTests(unittest.TestCase):
    def test_jest_bridge_has_unique_jest_assignment(self):
        bridge = RUNNER.NODE_TEST_ROOT / "native-contract-coverage.test.js"
        self.assertEqual("jest", RUNNER.classify_node_runner(bridge))
        for command in ("contract", "full"):
            with self.subTest(command=command):
                owners = [task for task in RUNNER.build_tasks(command) if bridge in task.files]
                self.assertEqual(1, len(owners))
                self.assertEqual("jest", owners[0].framework)

    def test_discovers_every_supported_test_file_once(self):
        discovered = RUNNER.discover_test_files()
        paths = [
            path
            for suite in RUNNER.SEMANTIC_SUITES
            for framework_paths in discovered[suite].values()
            for path in framework_paths
        ]
        expected = list(RUNNER.NODE_TEST_ROOT.rglob("*.test.js"))
        expected += list(set(RUNNER.PYTHON_TEST_ROOT.rglob("test_*.py")) | set(RUNNER.PYTHON_TEST_ROOT.rglob("*_test.py")))
        expected += list(RUNNER.E2E_TEST_ROOT.rglob("*.spec.js"))
        self.assertEqual(len(expected), len(paths))
        self.assertEqual(len(paths), len(set(paths)))

    def test_classification_uses_specific_categories_before_unit(self):
        cases = {
            "safe.gate.test.js": "gate",
            "profile-contract.test.js": "contract",
            "api.integration.test.js": "integration",
            "system-retrieval.test.js": "system",
            "ordinary.test.js": "unit",
            "demo_test.py": "integration",
            "test_api_client.py": "integration",
        }
        for name, expected in cases.items():
            with self.subTest(name=name):
                self.assertEqual(expected, RUNNER.classify_name(Path(name), "jest"))
        self.assertEqual("e2e", RUNNER.classify_name(Path("workflow.spec.js"), "playwright"))
        self.assertEqual("e2e", RUNNER.classify_name(Path("knowledge-center-scroll-contract.spec.js"), "playwright"))
        self.assertEqual("gate", RUNNER.classify_name(Path("performance.gate.spec.js"), "playwright"))

    def test_full_plan_has_no_duplicate_files(self):
        tasks = RUNNER.build_tasks("full")
        files = [path for task in tasks for path in task.files]
        self.assertTrue(tasks)
        self.assertEqual(len(files), len(set(files)))

    def test_smoke_plan_only_uses_existing_local_tests(self):
        tasks = RUNNER.build_tasks("smoke")
        files = [path for task in tasks for path in task.files]
        self.assertEqual(len(RUNNER.SMOKE_FILES), len(files))
        self.assertTrue(all(path.is_file() for path in files))
        self.assertNotIn("playwright", {task.framework for task in tasks})

    def test_all_is_full_alias(self):
        full = [(task.suite, task.framework, task.files) for task in RUNNER.build_tasks("full")]
        all_tasks = [(task.suite, task.framework, task.files) for task in RUNNER.build_tasks("all")]
        self.assertEqual(full, all_tasks)

    def test_playwright_performance_gate_uses_chromium_baseline(self):
        task = RUNNER.TestTask(
            "gate",
            "playwright",
            "performance gate",
            (RUNNER.E2E_TEST_ROOT / "knowledge-center-performance.gate.spec.js",),
        )
        command = RUNNER.task_command(task)
        self.assertEqual(["--project", "chromium"], command[-2:])

        e2e_task = RUNNER.TestTask("e2e", "playwright", "functional e2e", task.files)
        self.assertNotIn("--project", RUNNER.task_command(e2e_task))

    def test_e2e_specs_use_explicit_read_and_write_resource_lanes(self):
        tasks = [task for task in RUNNER.build_tasks("e2e") if task.framework == "playwright"]
        self.assertGreater(len(tasks), 1)
        self.assertEqual(
            {"service-read", "database-write"},
            {RUNNER.task_resource(task) for task in tasks},
        )
        read_task = next(task for task in tasks if RUNNER.task_resource(task) == "service-read")
        write_task = next(task for task in tasks if RUNNER.task_resource(task) == "database-write")
        self.assertGreater(len(read_task.files), len(write_task.files))
        self.assertIn("--workers 2", " ".join(RUNNER.task_command(read_task, jobs=4)))
        self.assertIn("--workers 1", " ".join(RUNNER.task_command(write_task, jobs=4)))

    def test_task_resource_classification_is_conservative(self):
        self.assertEqual("isolated-cpu", RUNNER.task_resource(
            RUNNER.TestTask("unit", "jest", "unit", (Path("ordinary.test.js"),))))
        self.assertEqual("database-write", RUNNER.task_resource(
            RUNNER.TestTask("e2e", "playwright", "e2e", (Path("flow.spec.js"),))))
        self.assertEqual("performance", RUNNER.task_resource(
            RUNNER.TestTask("gate", "playwright", "gate", (Path("perf.spec.js"),))))
        self.assertEqual("shared-state", RUNNER.task_resource(
            RUNNER.TestTask("integration", "node-script", "script", (Path("run.test.js"),))))

    def test_jobs_option_and_resource_aware_jest_command(self):
        self.assertEqual(3, RUNNER.parse_args(["unit", "--jobs", "3"]).jobs)
        with self.assertRaises(SystemExit):
            RUNNER.parse_args(["unit", "--jobs", "0"])
        task = RUNNER.TestTask("unit", "jest", "unit", (RUNNER.REPOSITORY_ROOT / "ordinary.test.js",))
        self.assertIn("--maxWorkers=3", RUNNER.task_command(task, jobs=3))
        integration = RUNNER.TestTask("integration", "jest", "integration", (RUNNER.REPOSITORY_ROOT / "integration.test.js",))
        self.assertIn("--runInBand", RUNNER.task_command(integration, jobs=3))

    def test_runner_classification_separates_framework_tests_and_scripts(self):
        with tempfile.TemporaryDirectory() as directory:
            node_script = Path(directory) / "standalone.test.js"
            node_script.write_text("process.exit(0);\n", encoding="utf-8")
            self.assertEqual("node-script", RUNNER.classify_node_runner(node_script))
        self.assertEqual(
            "node-test",
            RUNNER.classify_node_runner(RUNNER.NODE_TEST_ROOT / "template-p1.test.js"),
        )
        self.assertEqual(
            "jest",
            RUNNER.classify_node_runner(RUNNER.NODE_TEST_ROOT / "config-validator.test.js"),
        )
        self.assertEqual(
            "python-script",
            RUNNER.classify_python_runner(RUNNER.PYTHON_TEST_ROOT / "pingcode" / "test_api_client.py"),
        )
        self.assertEqual(
            "pytest",
            RUNNER.classify_python_runner(
                RUNNER.PYTHON_TEST_ROOT / "pingcode" / "web-backend" / "test_graph_store_contract.py"
            ),
        )

    def test_unittest_subclass_variants_are_recognized(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test_async.py"
            path.write_text(
                "import unittest\nclass AsyncTests(unittest.IsolatedAsyncioTestCase):\n    pass\n",
                encoding="utf-8",
            )
            self.assertEqual("unittest", RUNNER.classify_python_runner(path))

    def test_executable_scripts_are_isolated_into_one_process_per_file(self):
        tasks = RUNNER.build_tasks("full")
        script_tasks = [task for task in tasks if task.framework in {"node-script", "python-script"}]
        self.assertTrue(script_tasks)
        self.assertTrue(all(len(task.files) == 1 for task in script_tasks))
        self.assertTrue(all(RUNNER.task_command(task)[0] in {"node", RUNNER.python_executable()} for task in script_tasks))

    def test_node_test_task_executes_every_discovered_file(self):
        task = next(task for task in RUNNER.build_tasks("unit") if task.framework == "node-test")
        command = RUNNER.task_command(task)
        self.assertEqual([RUNNER.relative(path) for path in task.files], command[2:])

    def test_node_script_exit_does_not_stop_following_task(self):
        runtime_root = RUNNER.REPOSITORY_ROOT / "runtime"
        runtime_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=runtime_root) as directory:
            first = Path(directory) / "first.test.js"
            second = Path(directory) / "second.test.js"
            first.write_text("process.exit(1);\n", encoding="utf-8")
            second.write_text("process.exit(0);\n", encoding="utf-8")
            first_result = RUNNER.run_task(
                RUNNER.TestTask("unit", "node-script", "first", (first,)),
                dry_run=False,
                timeout=5,
            )
            second_result = RUNNER.run_task(
                RUNNER.TestTask("unit", "node-script", "second", (second,)),
                dry_run=False,
                timeout=5,
            )
        self.assertEqual("FAIL", first_result.status)
        self.assertEqual("PASS", second_result.status)

    def test_all_python_tests_are_isolated_by_file(self):
        tasks = RUNNER.build_tasks("unit")
        python_tasks = [task for task in tasks if task.framework in {"unittest", "pytest", "python-script"}]
        self.assertTrue(python_tasks)
        self.assertTrue(all(len(task.files) == 1 for task in python_tasks))

    def test_python_task_environment_includes_test_file_directory(self):
        path = RUNNER.PYTHON_TEST_ROOT / "pingcode" / "test_api_client.py"
        task = RUNNER.TestTask("unit", "python-script", "test", (path,))
        python_path = RUNNER.test_environment(task)["PYTHONPATH"].split(os.pathsep)
        self.assertIn(str(path.parent), python_path)

    def test_zero_unittest_collection_is_not_success(self):
        self.assertTrue(RUNNER.framework_reported_zero_tests("unittest", "Ran 0 tests in 0.000s\n\nOK\n"))
        self.assertFalse(RUNNER.framework_reported_zero_tests("unittest", "Ran 1 test in 0.001s\n\nOK\n"))

    def test_failure_extraction_is_framework_specific_and_deduplicated(self):
        output = "FAIL tests/example.test.js\n  ● suite › case\n  ● suite › case\n"
        self.assertEqual(
            ("suite › case", "tests/example.test.js"),
            RUNNER.extract_failed_tests("jest", output),
        )

    def test_execution_log_persists_commands_and_failures(self):
        result = RUNNER.TaskResult(
            "unit", "unit / Jest", "jest", "FAIL", 1.25, 1, 1,
            ("suite › broken case",), "node jest --runInBand",
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test-run.log"
            RUNNER.write_execution_log(path, "unit", [result], 1.25)
            entry = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual("node jest --runInBand", entry["tasks"][0]["command"])
        self.assertEqual(["suite › broken case"], entry["tasks"][0]["failedTests"])
        self.assertEqual(
            [{"task": "unit / Jest", "test": "suite › broken case"}],
            entry["failedTests"],
        )

    def test_coverage_is_only_available_for_full_and_all(self):
        self.assertTrue(RUNNER.parse_args(["full", "--coverage"]).coverage)
        self.assertTrue(RUNNER.parse_args(["all", "--coverage"]).coverage)
        with self.assertRaises(SystemExit):
            RUNNER.parse_args(["gate", "--coverage"])

    def test_coverage_runs_only_files_classified_for_jest(self):
        source = RUNNER_PATH.read_text(encoding="utf-8")
        self.assertIn('"--runTestsByPath"', source)

    def test_coverage_target_uses_exact_counts_not_rounded_percentage(self):
        target = json.loads(RUNNER.COVERAGE_TARGETS.read_text(encoding="utf-8"))["node"]
        self.assertTrue(RUNNER.coverage_meets_target(
            {"lines": {"covered": 100, "total": 100}, "branches": {"covered": 95, "total": 100}}, target,
        ))
        self.assertFalse(RUNNER.coverage_meets_target(
            {"lines": {"covered": 9999, "total": 10000}, "branches": {"covered": 95, "total": 100}}, target,
        ))
        self.assertFalse(RUNNER.coverage_meets_target(
            {"lines": {"covered": 100, "total": 100}, "branches": {"covered": 94, "total": 100}}, target,
        ))

    def test_full_coverage_gate_requires_every_runtime_and_green_tests(self):
        targets = json.loads(RUNNER.COVERAGE_TARGETS.read_text(encoding="utf-8"))
        perfect = {name: {"summary": {"lines": {"covered": 100, "total": 100},
                                               "branches": {"covered": 95, "total": 100}}} for name in targets}
        self.assertEqual(("PASS", []), RUNNER.coverage_gate_status(perfect, targets, 0))
        self.assertEqual("FAIL", RUNNER.coverage_gate_status(perfect, targets, 1)[0])
        status, shortfalls = RUNNER.coverage_gate_status({"node": perfect["node"]}, targets, 0)
        self.assertEqual("FAIL", status)
        self.assertIn("frontend 缺少覆盖率报告", shortfalls)
        self.assertIn("java 缺少覆盖率报告", shortfalls)

    def test_node_coverage_includes_unexecuted_product_sources(self):
        config = json.loads(subprocess.check_output(
            ["node", "-e", "process.stdout.write(JSON.stringify(require(process.argv[1])))", str(RUNNER.JEST_COVERAGE_CONFIG)],
            cwd=REPOSITORY_ROOT,
            text=True,
        ))
        self.assertEqual(str(REPOSITORY_ROOT), config["rootDir"])
        self.assertEqual(4, len(config["roots"]))
        self.assertTrue(all("/runtime" not in root for root in config["roots"]))
        included = {
            Path(name).resolve()
            for pattern in config["collectCoverageFrom"]
            for name in glob.glob(str(REPOSITORY_ROOT / pattern), recursive=True)
        }
        expected = {
            file.resolve()
            for directory in ("lib", "routes", "middleware")
            for file in (REPOSITORY_ROOT / "packages" / "agent-runner-core" / directory).rglob("*.js")
        }
        expected.update({
            REPOSITORY_ROOT / "apps" / "knowledge-center-api" / "server.js",
            REPOSITORY_ROOT / "apps" / "knowledge-center-web" / "frontend-server.js",
        })
        self.assertEqual(expected, included)

    def test_dry_run_does_not_fail_when_coverage_is_not_executed(self):
        coverage = RUNNER.CoverageSummary(
            "NOT_RUN", "Jest 管理的 JavaScript 代码", {}, diagnostic="dry-run 未执行"
        )
        self.assertTrue(RUNNER.coverage_succeeded(coverage, dry_run=True))
        self.assertFalse(RUNNER.coverage_succeeded(coverage, dry_run=False))

    def test_formal_run_uses_date_partition_and_compact_report_layout(self):
        with tempfile.TemporaryDirectory() as directory:
            old_report_root = RUNNER.TEST_REPORT_ROOT
            old_result_root = RUNNER.TEST_RESULT_ROOT
            try:
                RUNNER.TEST_REPORT_ROOT = Path(directory) / "test-reports"
                RUNNER.TEST_RESULT_ROOT = Path(directory) / "test-results"
                context = RUNNER.create_run_context(
                    "all", datetime(2026, 9, 21, 12, 34, 56, 123456, tzinfo=timezone.utc)
                )
            finally:
                RUNNER.TEST_REPORT_ROOT = old_report_root
                RUNNER.TEST_RESULT_ROOT = old_result_root
        self.assertTrue(context.formal)
        self.assertEqual("full", context.command)
        self.assertEqual("2026-09-21", context.run_dir.parent.name)
        self.assertEqual("details", context.details_dir.name)
        self.assertEqual("tasks", context.tasks_dir.name)

    def test_framework_counts_are_extracted_for_report_summary(self):
        self.assertEqual(
            (10, 7, 1, 2),
            RUNNER.extract_test_counts("jest", "Tests: 1 failed, 2 skipped, 7 passed, 10 total\n"),
        )
        self.assertEqual(
            (5, 3, 1, 1),
            RUNNER.extract_test_counts("pytest", "===== 1 failed, 1 skipped, 3 passed in 0.10s =====\n"),
        )
        self.assertEqual(
            (7, 6, 0, 1),
            RUNNER.extract_test_counts("node-test", "# tests 7\n# pass 6\n# fail 0\n# skipped 1\n"),
        )
        self.assertEqual(
            (6, 1, 1, 4),
            RUNNER.extract_test_counts("playwright", "1 failed\n4 did not run\n1 passed\n"),
        )

    def test_html_report_uses_saved_json_for_each_requested_suite(self):
        for suite in ("unit", "e2e", "smoke"):
            with self.subTest(suite=suite), tempfile.TemporaryDirectory() as directory:
                run_dir = Path(directory)
                details = run_dir / "details"
                details.mkdir()
                payload = RUNNER.report_payload(suite, [RUNNER.TaskResult(
                    suite, "正常任务", "jest", "PASS", 1.5, 0, 2,
                    test_total=3, test_passed=2, test_failed=0, test_skipped=1,
                    log_file="details/tasks/task.log",
                )], 2.0)
                (details / "report.json").write_text(json.dumps(payload), encoding="utf-8")
                report = RUNNER.write_html_report(run_dir)
                content = report.read_text(encoding="utf-8")
                self.assertIn(f"<title>{suite} 测试报告</title>", content)
                self.assertIn("2 / 0 / 1", content)
                self.assertIn('href="details/tasks/task.log"', content)

    def test_html_report_escapes_failures_and_handles_missing_counts_and_logs(self):
        payload = RUNNER.report_payload("unit", [RUNNER.TaskResult(
            "unit", "<任务>", "pytest", "FAIL", 0.2, 1, 1,
            failed_tests=("<script>alert(&quot;bad&quot;)</script>",),
            log_file="../outside.log",
        )], 0.3)
        content = RUNNER.render_html_report(payload)
        self.assertIn("未统计", content)
        self.assertIn("&lt;任务&gt;", content)
        self.assertIn("&lt;script&gt;", content)
        self.assertNotIn("<script>", content)
        self.assertNotIn("outside.log", content)
        self.assertIn("失败与阻塞", content)

    def test_test_environment_targets_the_instance_prepared_by_runner(self):
        self.assertEqual(RUNNER.KNOWLEDGE_CENTER_BASE_URL, RUNNER.test_environment()["KPG_BASE_URL"])
        environment = RUNNER.test_environment(
            knowledge_center_base_url="http://127.0.0.1:45678",
            knowledge_center_test_run_id="run-1",
            knowledge_center_storage_url="http://127.0.0.1:45679",
        )
        self.assertEqual("http://127.0.0.1:45679", environment["KC_STORAGE_URL"])
        self.assertEqual("http://127.0.0.1:45679", environment["YASDB_STORAGE_URL"])
        self.assertEqual("http://127.0.0.1:45678", environment["KPG_BASE_URL"])
        self.assertEqual("run-1", environment["KNOWLEDGE_CENTER_TEST_RUN_ID"])

    def test_browser_batches_keep_separate_failure_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            context = RUNNER.RunContext("full", "run-1", root, root, root, root / "artifacts", True)
            first = RUNNER.TestTask("e2e", "playwright", "浏览器测试", (Path("first.spec.js"),))
            second = RUNNER.TestTask("e2e", "playwright", "浏览器测试", (Path("second.spec.js"),))
            first_dir = Path(RUNNER.test_environment(first, context)["YASDB_TEST_ARTIFACT_DIR"])
            second_dir = Path(RUNNER.test_environment(second, context)["YASDB_TEST_ARTIFACT_DIR"])
            self.assertNotEqual(first_dir, second_dir)
            self.assertEqual(context.artifact_dir, first_dir.parent)
            self.assertEqual(context.artifact_dir, second_dir.parent)
            self.assertEqual(str(first_dir), RUNNER.test_environment(first, context)["YASDB_TEST_ARTIFACT_DIR"])

    def test_isolated_environment_uses_ephemeral_ports_and_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            old_result_root = RUNNER.TEST_RESULT_ROOT
            try:
                RUNNER.TEST_RESULT_ROOT = Path(directory) / "test-results"
                context = RUNNER.create_run_context("e2e")
                env, base_url, owner = RUNNER.isolated_knowledge_center_environment(context)
            finally:
                RUNNER.TEST_RESULT_ROOT = old_result_root
        self.assertTrue(base_url.startswith("http://127.0.0.1:"))
        self.assertTrue(owner.startswith("test-run:"))
        self.assertEqual("1", env["KNOWLEDGE_CENTER_NO_TAKEOVER"])
        self.assertEqual("test", env["KNOWLEDGE_CENTER_ENV"])
        self.assertEqual("test", env["KNOWLEDGE_CENTER_ENVIRONMENT"])
        self.assertEqual(context.run_id, env["KNOWLEDGE_CENTER_TEST_RUN_ID"])
        self.assertEqual("1", env["KNOWLEDGE_CENTER_E2E_INITIALIZE_PRODUCTION"])
        self.assertEqual(str(Path(env["KNOWLEDGE_CENTER_STATE_DIR"]).parent / "production-initialization"),
                         env["KNOWLEDGE_CENTER_E2E_INITIALIZATION_DIR"])
        self.assertEqual(str(RUNNER.TEST_DATABASE_CONFIG_DIR), env["YASDB_CONFIG_DIR"])
        self.assertEqual("database", env["KNOWLEDGE_STORAGE_MODE"])
        self.assertNotEqual("13510", base_url.rsplit(":", 1)[-1])

    def test_explicit_target_does_not_bypass_isolated_instance(self):
        old_base_url = os.environ.get("KPG_BASE_URL")
        os.environ["KPG_BASE_URL"] = "http://127.0.0.1:13510"
        original_environment = RUNNER.isolated_knowledge_center_environment
        try:
            RUNNER.isolated_knowledge_center_environment = lambda context: (_ for _ in ()).throw(RuntimeError("隔离配置校验"))
            context = RUNNER.create_run_context("e2e")
            ready, lease, diagnostic = RUNNER.ensure_knowledge_center(context)
        finally:
            RUNNER.isolated_knowledge_center_environment = original_environment
            if old_base_url is None:
                os.environ.pop("KPG_BASE_URL", None)
            else:
                os.environ["KPG_BASE_URL"] = old_base_url
        self.assertFalse(ready)
        self.assertIsNone(lease)
        self.assertIn("隔离配置", diagnostic)

    def test_e2e_database_sync_is_mandatory_before_service_start(self):
        source = RUNNER_PATH.read_text(encoding="utf-8")
        sync_script = RUNNER.E2E_DATABASE_SYNC_SCRIPT.read_text(encoding="utf-8")
        sync_call = source.index("synchronize_e2e_database(context, database_lock)")
        migration_call = source.index("migrate_e2e_database(context, env)")
        service_start = source.index('[str(KNOWLEDGE_CENTER_SCRIPT), *arguments]')
        self.assertLess(sync_call, migration_call)
        self.assertLess(migration_call, service_start)
        self.assertIn("sync-e2e-yashandb-schema.sh", source)
        self.assertIn("expected_source=\"${YASDB_E2E_SOURCE_SCHEMA:-pf_knowledge}\"", sync_script)
        self.assertIn("expected_target=\"${YASDB_E2E_TARGET_SCHEMA:-test_hy}\"", sync_script)
        self.assertIn("SyncYashanDbSchemaData", sync_script)
        self.assertNotIn("FROMUSER=", sync_script)
        self.assertNotIn("TOUSER=", sync_script)

    def test_dirty_migrations_are_rejected_for_every_schema(self):
        storage_script = RUNNER.YASHANDB_STORAGE_SCRIPT.read_text(encoding="utf-8")
        runner_source = RUNNER_PATH.read_text(encoding="utf-8")
        self.assertIn('"$migration_source_dirty" == false', storage_script)
        self.assertNotIn("KNOWLEDGE_CENTER_ALLOW_DIRTY_TEST_MIGRATIONS", storage_script)
        self.assertNotIn("KNOWLEDGE_CENTER_ALLOW_DIRTY_TEST_MIGRATIONS", runner_source)
        self.assertIn('[str(YASHANDB_STORAGE_SCRIPT), "migrate"]', runner_source)

    def test_e2e_database_lock_can_be_acquired_and_released(self):
        with tempfile.TemporaryDirectory() as directory:
            old_lock_file = RUNNER.E2E_DATABASE_LOCK_FILE
            try:
                RUNNER.E2E_DATABASE_LOCK_FILE = Path(directory) / "test-hy.lock"
                lock = RUNNER.acquire_e2e_database_lock(timeout_seconds=1)
                self.assertFalse(lock.closed)
                RUNNER.release_e2e_database_lock(lock)
                self.assertTrue(lock.closed)
            finally:
                RUNNER.E2E_DATABASE_LOCK_FILE = old_lock_file

    def test_test_sources_do_not_write_reports_or_temp_data_into_source_tree(self):
        forbidden = (
            'tests/e2e/agent-runner/reports',
            'Path(__file__).parent / "reports"',
            "path.join(__dirname, '..', '..', 'tmp'",
            "path.join(__dirname, '..', '..', 'agent-runner', 'tmp'",
        )
        offenders = []
        for path in (RUNNER.REPOSITORY_ROOT / "tests").rglob("*"):
            if path == Path(__file__) or path.suffix not in {".py", ".js", ".cjs"} or not path.is_file():
                continue
            source = path.read_text(encoding="utf-8", errors="ignore")
            if any(pattern in source for pattern in forbidden):
                offenders.append(path.relative_to(RUNNER.REPOSITORY_ROOT).as_posix())
        self.assertEqual([], offenders)

    def test_playwright_specs_do_not_fallback_to_shared_knowledge_center(self):
        offenders = []
        for path in RUNNER.E2E_TEST_ROOT.glob("*.spec.js"):
            source = path.read_text(encoding="utf-8", errors="ignore")
            if re.search(r"KPG_BASE_URL\s*\|\|", source) or re.search(
                r"https?://(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)",
                source,
            ):
                offenders.append(path.name)
        self.assertEqual([], offenders)


if __name__ == "__main__":
    unittest.main()
