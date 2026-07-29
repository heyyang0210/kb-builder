from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .skill_registry import (
    PUBLISHED,
    SEMVER,
    SKILL_ID,
    SkillDefinition,
    SkillRegistry,
    SkillRegistryError,
)


PROMPT_NAME = re.compile(r"^[a-z][a-z0-9_-]*$")


@dataclass(frozen=True)
class PromptDefinition:
    prompt_id: str
    skill_id: str
    skill_version: str
    name: str
    status: str
    content: str
    content_hash: str
    content_length: int
    file: str
    manifest: dict[str, Any]

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.prompt_id,
            "skillId": self.skill_id,
            "skillVersion": self.skill_version,
            "name": self.name,
            "status": self.status,
            "contentHash": self.content_hash,
            "contentLength": self.content_length,
            "file": self.file,
        }

    def detail(self) -> dict[str, Any]:
        result = self.summary()
        result.update(
            {
                "content": self.content,
                "manifest": self.manifest,
            }
        )
        return result


class PromptRegistryError(ValueError):
    pass


class PromptNotFoundError(KeyError):
    pass


class PromptRegistry:
    """从 Skill Manifest 映射的文件中扫描已发布 Prompt。"""

    def __init__(self, skill_root: Path):
        self.skills = SkillRegistry(skill_root)

    def list_published(
        self,
        skill_id: str | None = None,
        version: str | None = None,
    ) -> list[PromptDefinition]:
        if skill_id is not None and not SKILL_ID.fullmatch(skill_id):
            return []
        if version is not None and not SEMVER.fullmatch(version):
            raise PromptRegistryError(f"Prompt 版本必须是 SemVer：{version!r}")

        prompts: list[PromptDefinition] = []
        try:
            published_skills = self.skills.list_published()
        except SkillRegistryError as exc:
            raise PromptRegistryError(f"Skill Registry 无效：{exc}") from exc

        for skill in published_skills:
            if skill_id is not None and skill.skill_id != skill_id:
                continue
            if version is not None and skill.version != version:
                continue
            prompts.extend(self._load_skill_prompts(skill))

        return sorted(
            prompts,
            key=lambda item: (
                item.prompt_id,
                self._version_key(item.skill_version),
            ),
        )

    def get(self, prompt_id: str, version: str | None = None) -> PromptDefinition:
        candidates = [
            item
            for item in self.list_published()
            if item.prompt_id == prompt_id
        ]
        if version is not None:
            if not SEMVER.fullmatch(version):
                raise PromptRegistryError(f"Prompt 版本必须是 SemVer：{version!r}")
            candidates = [item for item in candidates if item.skill_version == version]
        if not candidates:
            suffix = f"@{version}" if version else ""
            raise PromptNotFoundError(f"Prompt 不存在：{prompt_id}{suffix}")
        return max(candidates, key=lambda item: self._version_key(item.skill_version))

    def _load_skill_prompts(self, skill: SkillDefinition) -> list[PromptDefinition]:
        prompts = skill.manifest.get("prompts", {})
        if not isinstance(prompts, dict):
            raise PromptRegistryError(f"prompts 必须是对象：{skill.skill_id}@{skill.version}")
        self._validate_skill_version_directory(skill)

        definitions: list[PromptDefinition] = []
        seen: set[str] = set()
        for name, relative_file in prompts.items():
            if not isinstance(name, str) or not PROMPT_NAME.fullmatch(name):
                raise PromptRegistryError(
                    f"Prompt 名称无效：{skill.skill_id}@{skill.version}:{name!r}"
                )
            prompt_id = f"{skill.skill_id}.{name}"
            if prompt_id in seen:
                raise PromptRegistryError(f"Prompt ID 重复：{prompt_id}@{skill.version}")
            seen.add(prompt_id)
            path = self._validate_prompt_file(skill.root, relative_file, prompt_id)
            content = self._read_content(path, prompt_id)
            content_hash = "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()
            definitions.append(
                PromptDefinition(
                    prompt_id=prompt_id,
                    skill_id=skill.skill_id,
                    skill_version=skill.version,
                    name=name,
                    status=skill.manifest.get("status", PUBLISHED),
                    content=content,
                    content_hash=content_hash,
                    content_length=len(content),
                    file=Path(relative_file).as_posix(),
                    manifest={
                        "skillId": skill.skill_id,
                        "skillVersion": skill.version,
                        "capability": skill.capability,
                        "promptName": name,
                        "file": Path(relative_file).as_posix(),
                    },
                )
            )
        return definitions

    @staticmethod
    def _validate_skill_version_directory(skill: SkillDefinition) -> None:
        if skill.root.parent.name != "versions":
            return
        directory_version = skill.root.name
        if not SEMVER.fullmatch(directory_version):
            raise PromptRegistryError(
                f"Skill 版本目录必须是 SemVer：{skill.skill_id}/{directory_version}"
            )
        if directory_version != skill.version:
            raise PromptRegistryError(
                f"Skill 版本目录与 Manifest 不一致："
                f"{skill.skill_id}/{directory_version} != {skill.version}"
            )

    @staticmethod
    def _validate_prompt_file(base_dir: Path, relative_file: Any, prompt_id: str) -> Path:
        if not isinstance(relative_file, str) or not relative_file.strip():
            raise PromptRegistryError(f"Prompt 文件路径无效：{prompt_id}")
        path = Path(relative_file)
        if path.is_absolute() or ".." in path.parts:
            raise PromptRegistryError(
                f"Prompt 文件不允许绝对路径或目录穿越：{prompt_id} -> {relative_file}"
            )
        resolved = (base_dir / path).resolve()
        base = base_dir.resolve()
        if base not in resolved.parents or not resolved.is_file():
            raise PromptRegistryError(f"Prompt 文件不存在：{prompt_id} -> {relative_file}")
        return resolved

    @staticmethod
    def _read_content(path: Path, prompt_id: str) -> str:
        try:
            content = path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeDecodeError) as exc:
            raise PromptRegistryError(f"Prompt 文件不是有效 UTF-8：{prompt_id}") from exc
        if not content.strip():
            raise PromptRegistryError(f"Prompt 文件不能为空：{prompt_id}")
        return content

    @staticmethod
    def _version_key(version: str) -> tuple[int, int, int]:
        return tuple(int(part) for part in version.split("."))
