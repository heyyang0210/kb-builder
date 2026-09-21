import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
RUNNER_PATH = REPOSITORY_ROOT / "tests" / "run_tests.py"
SPEC = importlib.util.spec_from_file_location("repository_test_runner", RUNNER_PATH)
RUNNER = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = RUNNER
SPEC.loader.exec_module(RUNNER)


class RepositoryTestRunnerTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
