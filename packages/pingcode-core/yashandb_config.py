"""读取仓库统一的 YashanDB 非敏感配置，密码始终由环境变量注入。"""

import json
import os
from pathlib import Path
from typing import Any


SECRET_PATTERN = ("password", "token", "secret", "api_key", "apikey")


def _assert_no_secrets(value: Any, location: str = "config") -> None:
    if not isinstance(value, dict):
        return
    for key, child in value.items():
        lowered = key.lower()
        if any(marker in lowered for marker in SECRET_PATTERN):
            raise ValueError(f"数据库配置禁止包含敏感字段：{location}.{key}")
        _assert_no_secrets(child, f"{location}.{key}")


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    value = json.loads(path.read_text(encoding="utf-8"))
    _assert_no_secrets(value)
    return value


def _merge(base: dict, override: dict) -> dict:
    result = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        elif value not in (None, ""):
            result[key] = value
    return result


def load_database_config(repository_root: Path | None = None, environ: dict | None = None) -> dict:
    root = (repository_root or Path(__file__).resolve().parents[2]).resolve()
    config_root = root / "config" / "database"
    data = _merge(
        _read_json(config_root / "yashandb.example.json"),
        _read_json(config_root / "yashandb.local.json"),
    )
    env = environ or os.environ
    jdbc = dict(data.get("jdbc", {}))
    storage = dict(data.get("storage", {}))
    exp_imp = dict(data.get("expImp", {}))
    mapping = {
        "YASDB_JDBC_URL": (jdbc, "url"),
        "YASDB_USERNAME": (jdbc, "username"),
        "YASDB_JDBC_JAR": (jdbc, "driverJar"),
        "YASDB_STORAGE_URL": (storage, "url"),
        "YASDB_STORAGE_HOST": (storage, "host"),
        "YASDB_STORAGE_PORT": (storage, "port"),
        "YASDB_STORAGE_TIMEOUT_MS": (storage, "timeoutMs"),
        "YASDB_STORAGE_THREADS": (storage, "threads"),
        "YASDB_STORAGE_MAX_BODY_BYTES": (storage, "maxBodyBytes"),
        "YASDB_STORAGE_SQL_DIR": (storage, "sqlDir"),
        "YASDB_EXP_SERVER_HOST": (exp_imp, "serverHost"),
        "YASDB_EXP_OWNER": (exp_imp, "owner"),
        "YASDB_IMP_FROMUSER": (exp_imp, "fromUser"),
        "YASDB_IMP_TOUSER": (exp_imp, "toUser"),
        "YASDB_EXP_OUTPUT_DIR": (exp_imp, "outputDir"),
        "YASDB_EXP_LOG_DIR": (exp_imp, "logDir"),
        "YASDB_EXP_ROWS": (exp_imp, "rows"),
        "YASDB_EXP_LOG_LEVEL": (exp_imp, "logLevel"),
    }
    for env_key, (target, key) in mapping.items():
        if env.get(env_key):
            value: Any = env[env_key]
            if key in {"port", "timeoutMs", "threads", "maxBodyBytes"}:
                value = int(value)
            target[key] = value
    data["jdbc"], data["storage"], data["expImp"] = jdbc, storage, exp_imp
    return data
