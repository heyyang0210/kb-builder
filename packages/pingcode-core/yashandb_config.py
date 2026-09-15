"""读取仓库统一的 YashanDB 非敏感配置，密码始终由环境变量注入。"""

import os
import re
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


def _read_dotenv(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"数据库配置文件不存在：{path}")
    values = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if not re.match(r"^YASDB_[A-Z_]+=", line):
            raise ValueError(f"数据库配置格式错误：{path}")
        key, value = line.split("=", 1)
        value = value.strip()
        if value.startswith(('"', "'")):
            if len(value) < 2 or value[0] != value[-1]:
                raise ValueError("数据库配置引号不匹配")
            value = value[1:-1]
        values[key.strip()] = value
    return values


def load_database_config(repository_root: Path | None = None, environ: dict | None = None) -> dict:
    root = (repository_root or Path(__file__).resolve().parents[2]).resolve()
    config_root = root / "config" / "yashandb"
    file_env = _read_dotenv(config_root / "service.env")
    env = {**file_env, **{k: v for k, v in (environ if environ is not None else os.environ).items() if v != ""}}
    jdbc, storage, exp_imp = {}, {}, {}
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
    return {"version": 1, "jdbc": jdbc, "storage": storage, "expImp": exp_imp}
