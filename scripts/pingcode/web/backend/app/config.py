import os
from dataclasses import dataclass
from pathlib import Path

from .platform_profile import load_profile


APP_DIR = Path(__file__).resolve().parent
PINGCODE_DIR = APP_DIR.parents[2]
PLATFORM_PROFILE = load_profile()
platform_context = PLATFORM_PROFILE["context"]


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    data_root: Path
    pingcode_config: Path
    cors_origins: tuple[str, ...]
    cors_origin_regex: str | None
    processing_skill_root: Path
    processing_prompt_draft_root: Path
    model_gateway_url: str
    model_gateway_token: str
    model_gateway_timeout: int
    upload_token: str
    upload_chunk_size: int
    upload_max_file_size: int
    upload_max_session_size: int
    upload_max_files: int
    upload_retention_days: int
    preparation_max_archive_files: int
    preparation_max_archive_bytes: int
    preparation_max_archive_depth: int
    preparation_max_expansion_ratio: float
    keyword_filter_batch_size: int
    keyword_filter_max_retries: int


def load_settings() -> Settings:
    data_root = Path(
        os.getenv("PINGCODE_WEB_DATA_ROOT", str(PINGCODE_DIR / "runtime" / "web"))
    ).expanduser().resolve()
    config_path = Path(
        os.getenv("PINGCODE_CONFIG", str(PINGCODE_DIR / "config" / "pingcode.json"))
    ).expanduser().resolve()
    origins = tuple(
        origin.strip()
        for origin in os.getenv(
            "PINGCODE_WEB_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    )
    origin_regex = os.getenv(
        "PINGCODE_WEB_CORS_ORIGIN_REGEX",
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    ).strip() or None
    skill_root = Path(
        os.getenv(
            "PINGCODE_PROCESSING_SKILL_ROOT",
            str(PINGCODE_DIR / "processing" / "skills"),
        )
    ).expanduser().resolve()
    prompt_draft_root = Path(
        os.getenv(
            "PINGCODE_PROCESSING_PROMPT_DRAFT_ROOT",
            str(data_root / "processing" / "prompt-drafts"),
        )
    ).expanduser().resolve()
    upload_token = os.getenv("MATERIAL_UPLOAD_TOKEN", "")
    return Settings(
        host=os.getenv("PINGCODE_WEB_HOST", "0.0.0.0"),
        port=int(os.getenv("PINGCODE_WEB_PORT", "8000")),
        data_root=data_root,
        pingcode_config=config_path,
        cors_origins=origins,
        cors_origin_regex=origin_regex,
        processing_skill_root=skill_root,
        processing_prompt_draft_root=prompt_draft_root,
        model_gateway_url=os.getenv(
            "AGENT_RUNNER_MODEL_GATEWAY_URL",
            "http://127.0.0.1:4100/api/model-provider",
        ).rstrip("/"),
        model_gateway_token=os.getenv("MODEL_GATEWAY_INTERNAL_TOKEN", ""),
        model_gateway_timeout=int(os.getenv("MODEL_GATEWAY_TIMEOUT_SECONDS", "180")),
        upload_token=upload_token,
        upload_chunk_size=int(os.getenv("MATERIAL_UPLOAD_CHUNK_SIZE", str(8 * 1024 * 1024))),
        upload_max_file_size=int(os.getenv("MATERIAL_UPLOAD_MAX_FILE_SIZE", str(2 * 1024 * 1024 * 1024))),
        upload_max_session_size=int(os.getenv("MATERIAL_UPLOAD_MAX_SESSION_SIZE", str(10 * 1024 * 1024 * 1024))),
        upload_max_files=int(os.getenv("MATERIAL_UPLOAD_MAX_FILES", "10000")),
        upload_retention_days=int(os.getenv("MATERIAL_UPLOAD_RETENTION_DAYS", "30")),
        preparation_max_archive_files=int(os.getenv("MATERIAL_PREP_MAX_ARCHIVE_FILES", "10000")),
        preparation_max_archive_bytes=int(os.getenv("MATERIAL_PREP_MAX_ARCHIVE_BYTES", str(20 * 1024 * 1024 * 1024))),
        preparation_max_archive_depth=int(os.getenv("MATERIAL_PREP_MAX_ARCHIVE_DEPTH", "3")),
        preparation_max_expansion_ratio=float(os.getenv("MATERIAL_PREP_MAX_EXPANSION_RATIO", "100")),
        keyword_filter_batch_size=max(1, int(os.getenv("KEYWORD_FILTER_BATCH_SIZE", "50"))),
        keyword_filter_max_retries=max(0, int(os.getenv("KEYWORD_FILTER_MAX_RETRIES", "1"))),
    )


settings = load_settings()
settings.data_root.mkdir(parents=True, exist_ok=True)
