from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
SKILL_ID = re.compile(r"^[a-z][a-z0-9-]*$")
CAPABILITIES = {"chat", "vision", "embedding"}
PUBLISHED = "published"


@dataclass(frozen=True)
class SkillDefinition:
    skill_id: str
    version: str
    capability: str
    description: str
    manifest: dict[str, Any]
    skill_markdown: str
    root: Path

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.skill_id,
            "version": self.version,
            "capability": self.capability,
            "description": self.description,
            "status": self.manifest.get("status", PUBLISHED),
        }

    def detail(self) -> dict[str, Any]:
        result = self.summary()
        result.update(
            {
                "manifest": self.manifest,
                "skillMarkdown": self.skill_markdown,
                "files": self._file_summary(),
            }
        )
        return result

    def _file_summary(self) -> dict[str, str]:
        paths = {
            "manifest": "skill.yaml",
            "skill": "SKILL.md",
            "inputSchema": self.manifest["inputSchema"],
            "outputSchema": self.manifest["outputSchema"],
        }
        prompts = self.manifest.get("prompts", {})
        for name, relative_path in prompts.items():
            paths[f"prompt.{name}"] = relative_path
        return paths


class SkillRegistryError(ValueError):
    pass


class SkillNotFoundError(KeyError):
    pass


class SkillRegistry:
    """从文件系统扫描已发布 Skill，不写入运行时数据库。"""

    def __init__(self, root: Path):
        self.root = root.resolve()

    def list_published(self) -> list[SkillDefinition]:
        if not self.root.exists():
            return []
        definitions: list[SkillDefinition] = []
        seen: set[tuple[str, str]] = set()
        for skill_dir in sorted(self.root.iterdir(), key=lambda item: item.name):
            if not skill_dir.is_dir() or skill_dir.name.startswith("."):
                continue
            candidates = self._manifest_candidates(skill_dir)
            for manifest_path in candidates:
                definition = self._load(skill_dir, manifest_path)
                key = (definition.skill_id, definition.version)
                if key in seen:
                    raise SkillRegistryError(
                        f"Skill 版本重复：{definition.skill_id}@{definition.version}"
                    )
                seen.add(key)
                if definition.manifest.get("status", PUBLISHED) == PUBLISHED:
                    definitions.append(definition)
        return sorted(definitions, key=lambda item: (item.skill_id, self._version_key(item.version)))

    def get(self, skill_id: str, version: str | None = None) -> SkillDefinition:
        candidates = [item for item in self.list_published() if item.skill_id == skill_id]
        if version is not None:
            candidates = [item for item in candidates if item.version == version]
        if not candidates:
            suffix = f"@{version}" if version else ""
            raise SkillNotFoundError(f"Skill 不存在：{skill_id}{suffix}")
        return max(candidates, key=lambda item: self._version_key(item.version))

    def _manifest_candidates(self, skill_dir: Path) -> list[Path]:
        root_manifest = skill_dir / "skill.yaml"
        candidates = [root_manifest] if root_manifest.is_file() else []
        versions_dir = skill_dir / "versions"
        if versions_dir.is_dir():
            candidates.extend(
                path / "skill.yaml"
                for path in sorted(versions_dir.iterdir(), key=lambda item: item.name)
                if path.is_dir() and (path / "skill.yaml").is_file()
            )
        return candidates

    def _load(self, skill_dir: Path, manifest_path: Path) -> SkillDefinition:
        try:
            manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as exc:
            raise SkillRegistryError(f"Skill Manifest 读取失败：{manifest_path.name}") from exc
        if not isinstance(manifest, dict):
            raise SkillRegistryError(f"Skill Manifest 必须是对象：{manifest_path}")

        skill_id = manifest.get("id")
        version = manifest.get("version")
        capability = manifest.get("capability")
        if not isinstance(skill_id, str) or not SKILL_ID.fullmatch(skill_id):
            raise SkillRegistryError(f"Skill ID 无效：{skill_id!r}")
        if skill_id != skill_dir.name:
            raise SkillRegistryError(f"Skill ID 与目录名不一致：{skill_id} != {skill_dir.name}")
        if not isinstance(version, str) or not SEMVER.fullmatch(version):
            raise SkillRegistryError(f"Skill 版本必须是 SemVer：{skill_id}@{version!r}")
        if capability not in CAPABILITIES:
            raise SkillRegistryError(f"Skill 能力类型无效：{skill_id}@{version}：{capability!r}")
        if manifest.get("status", PUBLISHED) not in {PUBLISHED, "draft", "deprecated"}:
            raise SkillRegistryError(f"Skill 状态无效：{skill_id}@{version}")

        base_dir = manifest_path.parent
        self._validate_file(base_dir, "SKILL.md", "SKILL.md")
        input_schema = self._validate_file(base_dir, manifest.get("inputSchema"), "inputSchema")
        output_schema = self._validate_file(base_dir, manifest.get("outputSchema"), "outputSchema")
        self._load_json(input_schema, "inputSchema")
        self._load_json(output_schema, "outputSchema")
        prompts = manifest.get("prompts", {})
        if not isinstance(prompts, dict):
            raise SkillRegistryError(f"prompts 必须是对象：{skill_id}@{version}")
        for name, relative_path in prompts.items():
            self._validate_file(base_dir, relative_path, f"prompts.{name}")

        return SkillDefinition(
            skill_id=skill_id,
            version=version,
            capability=capability,
            description=str(manifest.get("description", "")),
            manifest=manifest,
            skill_markdown=(base_dir / "SKILL.md").read_text(encoding="utf-8"),
            root=base_dir,
        )

    @staticmethod
    def _validate_file(base_dir: Path, relative_path: Any, field: str) -> Path:
        if not isinstance(relative_path, str) or not relative_path.strip():
            raise SkillRegistryError(f"{field} 必须是相对文件路径")
        path = Path(relative_path)
        if path.is_absolute() or ".." in path.parts:
            raise SkillRegistryError(f"{field} 不允许绝对路径或目录穿越：{relative_path}")
        resolved = (base_dir / path).resolve()
        if base_dir.resolve() not in resolved.parents or not resolved.is_file():
            raise SkillRegistryError(f"{field} 文件不存在：{relative_path}")
        return resolved

    @staticmethod
    def _load_json(path: Path, field: str) -> dict[str, Any]:
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SkillRegistryError(f"{field} Schema 不是有效 JSON：{path.name}") from exc
        if not isinstance(value, dict):
            raise SkillRegistryError(f"{field} Schema 必须是 JSON 对象：{path.name}")
        return value

    @staticmethod
    def _version_key(version: str) -> tuple[int, int, int]:
        return tuple(int(part) for part in version.split("."))
