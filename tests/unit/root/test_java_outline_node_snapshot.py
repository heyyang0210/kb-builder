import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
JAVA = ROOT / "apps" / "yashandb-storage" / "src" / "OutlineNodeSnapshot.java"
HARNESS = ROOT / "tests" / "unit" / "root" / "OutlineNodeSnapshotTest.java"


class JavaOutlineNodeSnapshotTests(unittest.TestCase):
    def test_valid_and_boundary_outline_shapes(self):
        with tempfile.TemporaryDirectory(prefix="outline-java-test-") as output:
            compile_result = subprocess.run(
                ["java", "-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", output, str(JAVA), str(HARNESS)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(compile_result.returncode, 0, compile_result.stderr)
            run_result = subprocess.run(
                ["java", "-cp", output, "OutlineNodeSnapshotTest"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(run_result.returncode, 0, run_result.stderr)


if __name__ == "__main__":
    unittest.main()
