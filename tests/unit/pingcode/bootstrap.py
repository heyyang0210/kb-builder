"""测试用 PingCode 共享包加载器。"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PACKAGE_DIR = ROOT / "packages" / "pingcode-core"
if "pingcode_core" not in sys.modules:
    spec = importlib.util.spec_from_file_location(
        "pingcode_core", PACKAGE_DIR / "__init__.py", submodule_search_locations=[str(PACKAGE_DIR)]
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules["pingcode_core"] = module
    spec.loader.exec_module(module)
