import os
import pty
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]


class MigrationRepairCommandTest(unittest.TestCase):
    def run_command(self, target_class=None, approval_ref=None):
        with tempfile.TemporaryDirectory(prefix="kc-migration-repair-") as directory:
            env = os.environ.copy()
            env.update({
                "KNOWLEDGE_CENTER_ENV_FILE": str(Path(directory) / "missing.env"),
                "YASDB_CONFIG_DIR": directory,
                "KNOWLEDGE_CENTER_LOG_DIR": str(Path(directory) / "logs"),
                "KNOWLEDGE_CENTER_STATE_DIR": str(Path(directory) / "state"),
            })
            env.pop("YASDB_STORAGE_TARGET_CLASS", None)
            env.pop("MIGRATION_APPROVAL_REF", None)
            if target_class:
                env["YASDB_STORAGE_TARGET_CLASS"] = target_class
            if approval_ref:
                env["MIGRATION_APPROVAL_REF"] = approval_ref
            return subprocess.run(
                [str(REPO_ROOT / "knowledge-center.sh"), "repair-migrations"],
                cwd=REPO_ROOT, env=env, capture_output=True, text=True, check=False,
            )

    def test_target_class_is_required_before_database_access(self):
        result = self.run_command()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("请显式设置 YASDB_STORAGE_TARGET_CLASS", result.stderr)
        self.assertNotIn("执行迁移", result.stdout)

    def test_noninteractive_shared_database_requires_approval_reference(self):
        result = self.run_command(target_class="shared")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("非交互执行须提供实际的 MIGRATION_APPROVAL_REF", result.stderr)
        self.assertNotIn("执行迁移", result.stdout)

    def test_noninteractive_shared_database_rejects_documentation_placeholder(self):
        result = self.run_command(target_class="shared", approval_ref="<审批引用>")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("非交互执行须提供实际的 MIGRATION_APPROVAL_REF", result.stderr)
        self.assertNotIn("执行迁移", result.stdout)

    def test_startup_diagnostic_shows_one_repair_command(self):
        with tempfile.TemporaryDirectory(prefix="kc-migration-diagnostic-") as directory:
            log_file = Path(directory) / "storage.log"
            log_file.write_text(
                "java.sql.SQLException: 存在待执行的数据库迁移，请先执行 start.sh migrate：017_pingcode_task_sync\n",
                encoding="utf-8",
            )
            env = os.environ.copy()
            env.update({
                "KNOWLEDGE_CENTER_ENV_FILE": str(Path(directory) / "missing.env"),
                "YASDB_CONFIG_DIR": directory,
                "KNOWLEDGE_CENTER_LOG_DIR": str(Path(directory) / "logs"),
                "KNOWLEDGE_CENTER_STATE_DIR": str(Path(directory) / "state"),
            })
            result = subprocess.run(
                ["bash", "-c", 'source ./knowledge-center.sh help >/dev/null; print_component_failure_details storage "$1"',
                 "bash", str(log_file)],
                cwd=REPO_ROOT, env=env, capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("017_pingcode_task_sync", result.stderr)
            self.assertEqual(result.stderr.count("repair-migrations"), 1)
            self.assertNotIn("start.sh migrate", result.stderr)

    def test_restart_checks_migration_before_stopping_services(self):
        with tempfile.TemporaryDirectory(prefix="kc-migration-preflight-") as directory:
            fake_storage = Path(directory) / "storage"
            fake_storage.mkdir()
            start_script = fake_storage / "start.sh"
            start_script.write_text(
                '#!/bin/sh\necho "存在待执行的数据库迁移，请先执行 start.sh migrate：017_pingcode_task_sync" >&2\nexit 1\n',
                encoding="utf-8",
            )
            start_script.chmod(0o755)
            env = os.environ.copy()
            env.update({
                "KNOWLEDGE_CENTER_ENV_FILE": str(Path(directory) / "missing.env"),
                "YASDB_CONFIG_DIR": directory,
                "KNOWLEDGE_CENTER_LOG_DIR": str(Path(directory) / "logs"),
                "KNOWLEDGE_CENTER_STATE_DIR": str(Path(directory) / "state"),
                "FAKE_STORAGE_DIR": str(fake_storage),
                "YASDB_STORAGE_TARGET_CLASS": "shared",
            })
            result = subprocess.run(
                ["bash", "-c", """source ./knowledge-center.sh help >/dev/null
STORAGE_DIR="$FAKE_STORAGE_DIR"
NO_BUILD=1
validate_environment() { :; }
validate_build_artifact() { :; }
validate_database_connection() { :; }
reconcile_known_services() { echo RECONCILE_CALLED; }
stop_all() { echo STOP_CALLED; }
restart_platform"""],
                cwd=REPO_ROOT, env=env, capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("现有服务未停止", result.stderr)
            self.assertIn("017_pingcode_task_sync", result.stderr)
            self.assertIn("YASDB_STORAGE_TARGET_CLASS=shared", result.stderr)
            self.assertNotIn("STOP_CALLED", result.stdout)

    def test_interactive_shared_confirmation_records_approval(self):
        with tempfile.TemporaryDirectory(prefix="kc-migration-approval-") as directory:
            snapshot = Path(directory) / "schema.dump"
            snapshot.write_bytes(b"schema-only fixture")
            env = os.environ.copy()
            env.update({
                "KNOWLEDGE_CENTER_ENV_FILE": str(Path(directory) / "missing.env"),
                "YASDB_CONFIG_DIR": directory,
                "KNOWLEDGE_CENTER_LOG_DIR": str(Path(directory) / "logs"),
                "KNOWLEDGE_CENTER_STATE_DIR": str(Path(directory) / "state"),
                "YASDB_JDBC_URL": "jdbc:yasdb://example.invalid/test",
                "YASDB_SCHEMA_SNAPSHOT_PATH": str(snapshot),
            })
            env.pop("MIGRATION_APPROVAL_REF", None)
            master, slave = pty.openpty()
            try:
                process = subprocess.Popen(
                    ["bash", "-c", "source ./knowledge-center.sh help >/dev/null; confirm_shared_migration"],
                    cwd=REPO_ROOT, env=env, stdin=slave,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                )
                os.close(slave)
                os.write(master, "批准执行共享库迁移\n".encode("utf-8"))
                stdout, stderr = process.communicate(timeout=5)
            finally:
                os.close(master)
            self.assertEqual(process.returncode, 0, stderr)
            self.assertIn("本次确认记录", stdout)
            records = list((Path(directory) / "state").glob("migration-approval-*.log"))
            self.assertEqual(len(records), 1)
            record = records[0].read_text(encoding="utf-8")
            self.assertIn("method=terminal", record)
            self.assertIn(f"snapshot={snapshot}", record)
            self.assertIn("snapshotSha256=", record)

    def test_shared_confirmation_rejects_sql_directory_as_snapshot(self):
        with tempfile.TemporaryDirectory(prefix="kc-migration-snapshot-") as directory:
            env = os.environ.copy()
            env.update({
                "KNOWLEDGE_CENTER_ENV_FILE": str(Path(directory) / "missing.env"),
                "YASDB_CONFIG_DIR": directory,
                "KNOWLEDGE_CENTER_LOG_DIR": str(Path(directory) / "logs"),
                "KNOWLEDGE_CENTER_STATE_DIR": str(Path(directory) / "state"),
                "YASDB_SCHEMA_SNAPSHOT_PATH": str(REPO_ROOT / "apps/yashandb-storage/sql"),
                "MIGRATION_APPROVAL_REF": "approved-test",
            })
            result = subprocess.run(
                ["bash", "-c", "source ./knowledge-center.sh help >/dev/null; confirm_shared_migration"],
                cwd=REPO_ROOT, env=env, capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("不能填 SQL 源目录", result.stderr)
            self.assertEqual(list((Path(directory) / "state").glob("migration-approval-*.log")), [])


if __name__ == "__main__":
    unittest.main()
