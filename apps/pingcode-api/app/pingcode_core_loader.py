"""Register the hyphenated repository package as an importable Python package."""

import importlib.util
import sys
from pathlib import Path


def ensure_pingcode_core(repository_root: Path) -> None:
    package_name = "pingcode_core"
    if package_name in sys.modules:
        return
    package_dir = repository_root / "packages" / "pingcode-core"
    spec = importlib.util.spec_from_file_location(
        package_name, package_dir / "__init__.py", submodule_search_locations=[str(package_dir)]
    )
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载共享包：{package_dir}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[package_name] = module
    spec.loader.exec_module(module)
