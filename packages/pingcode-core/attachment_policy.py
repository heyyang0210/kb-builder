"""PingCode 附件下载策略。"""

from pathlib import Path


class AttachmentPolicy:
    ARCHIVE_EXTENSIONS = {"zip", "tar", "7z", "rar", "gz", "bz2", "xz"}
    EXCLUDED_EXTENSIONS = {
        "app",
        "bat",
        "bin",
        "c",
        "cmd",
        "com",
        "cpp",
        "cs",
        "dll",
        "dmg",
        "exe",
        "go",
        "h",
        "hpp",
        "iso",
        "jar",
        "java",
        "js",
        "jsx",
        "msi",
        "php",
        "pl",
        "ps1",
        "py",
        "rb",
        "rs",
        "scr",
        "sh",
        "so",
        "swift",
        "ts",
        "tsx",
        "vb",
        "vbs",
    }

    @classmethod
    def should_download(cls, filename: str, requested_types: set[str] | None = None) -> bool:
        extension = Path(filename).suffix.lower().lstrip(".")
        requested = {item.lower().lstrip(".") for item in (requested_types or set())}
        if extension in cls.EXCLUDED_EXTENSIONS:
            return False
        if requested:
            return extension in requested
        return extension not in cls.ARCHIVE_EXTENSIONS

    @classmethod
    def category(cls, filename: str) -> str:
        extension = Path(filename).suffix.lower().lstrip(".")
        if extension in cls.EXCLUDED_EXTENSIONS:
            return "excluded"
        if extension in cls.ARCHIVE_EXTENSIONS:
            return "archive"
        return "allowed"
