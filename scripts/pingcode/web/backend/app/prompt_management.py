from __future__ import annotations

import difflib
import hashlib
import json
import re
import shutil
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from .prompt_registry import PromptDefinition, PromptRegistry, PromptRegistryError
from .skill_registry import SEMVER, SkillDefinition, SkillRegistry


VARIABLE_BLOCK = re.compile(r"\{\{(.*?)\}\}", re.DOTALL)
VARIABLE_NAME = re.compile(r"^[a-z][a-z0-9_]*$")
SENSITIVE_PATTERNS = (
    re.compile(
        r"(?i)\b(?:api[_ -]?key|password|secret|cookie|authorization|bearer|access[_ -]?token)\b"
        r"\s*[:=]\s*['\"]?[A-Za-z0-9_./+=:-]{8,}"
    ),
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"-----BEGIN [^-]+ PRIVATE KEY-----"),
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def content_hash(content: str) -> str:
    return "sha256:" + hashlib.sha256(content.encode("utf-8")).hexdigest()


def camel_to_snake(value: str) -> str:
    return re.sub(r"(?<!^)([A-Z])", r"_\1", value).lower()


@dataclass(frozen=True)
class PromptDraft:
    draft_id: str
    prompt_id: str
    skill_id: str
    prompt_name: str
    base_version: str
    revision: int
    status: str
    actor_id: str
    created_at: str
    updated_at: str
    content_hash: str
    content: str
    last_validation: dict[str, Any] | None = None
    published_version: str | None = None

    def summary(self) -> dict[str, Any]:
        return {
            "id": self.draft_id,
            "promptId": self.prompt_id,
            "skillId": self.skill_id,
            "promptName": self.prompt_name,
            "baseVersion": self.base_version,
            "revision": self.revision,
            "status": self.status,
            "actorId": self.actor_id,
            "createdAt": self.created_at,
            "updatedAt": self.updated_at,
            "contentHash": self.content_hash,
            "contentLength": len(self.content),
            "publishedVersion": self.published_version,
        }

    def detail(self) -> dict[str, Any]:
        result = self.summary()
        result.update(
            {
                "content": self.content,
                "lastValidation": self.last_validation,
            }
        )
        return result


class PromptDraftNotFoundError(KeyError):
    pass


class PromptDraftConflictError(ValueError):
    pass


class PromptValidationError(ValueError):
    def __init__(self, result: dict[str, Any]):
        super().__init__("Prompt 校验失败")
        self.result = result


class PromptPublishConflictError(ValueError):
    pass


class PromptDraftStore:
    """以目录文件保存 Prompt 草稿，正文与元数据分离。"""

    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()

    def create(self, prompt: PromptDefinition, content: str, actor_id: str) -> PromptDraft:
        with self._lock:
            now = utcnow().isoformat()
            draft_id = f"prompt_draft_{uuid.uuid4().hex[:16]}"
            directory = self.root / draft_id
            directory.mkdir(parents=True)
            metadata = {
                "id": draft_id,
                "promptId": prompt.prompt_id,
                "skillId": prompt.skill_id,
                "promptName": prompt.name,
                "baseVersion": prompt.skill_version,
                "revision": 1,
                "status": "draft",
                "actorId": actor_id,
                "createdAt": now,
                "updatedAt": now,
                "contentFile": "content.md",
                "contentHash": content_hash(content),
                "lastValidation": None,
                "publishedVersion": None,
            }
            self._write_content(directory, content)
            self._write_metadata(directory, metadata)
            return self._load_directory(directory)

    def get(self, draft_id: str) -> PromptDraft:
        with self._lock:
            directory = self._directory(draft_id)
            if not directory.is_dir():
                raise PromptDraftNotFoundError(draft_id)
            try:
                return self._load_directory(directory)
            except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError) as exc:
                raise PromptDraftNotFoundError(draft_id) from exc

    def update(
        self,
        draft_id: str,
        content: str,
        expected_revision: int,
        actor_id: str,
    ) -> PromptDraft:
        with self._lock:
            current = self.get(draft_id)
            if current.status == "published":
                raise PromptDraftConflictError("已发布草稿不可修改")
            if current.revision != expected_revision:
                raise PromptDraftConflictError(
                    f"草稿 revision 冲突：期望 {expected_revision}，当前 {current.revision}"
                )
            directory = self._directory(draft_id)
            metadata = self._read_metadata(directory)
            metadata.update(
                {
                    "revision": current.revision + 1,
                    "status": "draft",
                    "actorId": actor_id,
                    "updatedAt": utcnow().isoformat(),
                    "contentHash": content_hash(content),
                    "lastValidation": None,
                    "publishedVersion": None,
                }
            )
            self._write_content(directory, content)
            self._write_metadata(directory, metadata)
            return self._load_directory(directory)

    def save_validation(self, draft_id: str, result: dict[str, Any]) -> PromptDraft:
        with self._lock:
            current = self.get(draft_id)
            directory = self._directory(draft_id)
            metadata = self._read_metadata(directory)
            metadata["lastValidation"] = result
            if current.status != "published":
                metadata["status"] = "validated" if result["passed"] else "draft"
            self._write_metadata(directory, metadata)
            return self._load_directory(self._directory(current.draft_id))

    def mark_published(self, draft_id: str, version: str, actor_id: str) -> PromptDraft:
        with self._lock:
            current = self.get(draft_id)
            directory = self._directory(draft_id)
            metadata = self._read_metadata(directory)
            metadata.update(
                {
                    "status": "published",
                    "publishedVersion": version,
                    "actorId": actor_id,
                    "updatedAt": utcnow().isoformat(),
                }
            )
            self._write_metadata(directory, metadata)
            return self._load_directory(self._directory(current.draft_id))

    def _directory(self, draft_id: str) -> Path:
        if not re.fullmatch(r"prompt_draft_[a-f0-9]{16}", draft_id):
            raise PromptDraftNotFoundError(draft_id)
        directory = (self.root / draft_id).resolve()
        if self.root not in directory.parents:
            raise PromptDraftNotFoundError(draft_id)
        return directory

    @staticmethod
    def _read_metadata(directory: Path) -> dict[str, Any]:
        return json.loads((directory / "draft.json").read_text(encoding="utf-8"))

    @staticmethod
    def _write_metadata(directory: Path, metadata: dict[str, Any]) -> None:
        temporary = directory / "draft.json.tmp"
        temporary.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        temporary.replace(directory / "draft.json")

    @staticmethod
    def _write_content(directory: Path, content: str) -> None:
        temporary = directory / "content.md.tmp"
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(directory / "content.md")

    def _load_directory(self, directory: Path) -> PromptDraft:
        metadata = self._read_metadata(directory)
        content_file = metadata.get("contentFile", "content.md")
        content = (directory / content_file).read_text(encoding="utf-8")
        return PromptDraft(
            draft_id=metadata["id"],
            prompt_id=metadata["promptId"],
            skill_id=metadata["skillId"],
            prompt_name=metadata["promptName"],
            base_version=metadata["baseVersion"],
            revision=int(metadata["revision"]),
            status=metadata["status"],
            actor_id=metadata["actorId"],
            created_at=metadata["createdAt"],
            updated_at=metadata["updatedAt"],
            content_hash=metadata["contentHash"],
            content=content,
            last_validation=metadata.get("lastValidation"),
            published_version=metadata.get("publishedVersion"),
        )


class PromptContentValidator:
    def validate(self, content: str, skill: SkillDefinition) -> dict[str, Any]:
        issues: list[dict[str, str]] = []
        if not isinstance(content, str) or not content.strip():
            issues.append({"code": "EMPTY_CONTENT", "message": "Prompt 内容不能为空"})
            return self._result(issues, [])

        schema = self._load_input_schema(skill)
        declared = {
            camel_to_snake(name)
            for name in schema.get("properties", {})
            if isinstance(name, str)
        }
        variables: list[str] = []
        blocks = list(VARIABLE_BLOCK.finditer(content))
        if content.count("{{") != len(blocks) or content.count("}}") != len(blocks):
            issues.append(
                {
                    "code": "MALFORMED_VARIABLE",
                    "message": "存在未闭合或多余的大括号变量标记",
                }
            )
        for match in blocks:
            name = match.group(1).strip()
            if not VARIABLE_NAME.fullmatch(name):
                issues.append({"code": "INVALID_VARIABLE", "message": f"变量名无效：{name!r}"})
                continue
            variables.append(name)
            if name not in declared:
                issues.append(
                    {
                        "code": "UNDECLARED_VARIABLE",
                        "message": f"变量未在输入 Schema 中声明：{name}",
                    }
                )
        for pattern in SENSITIVE_PATTERNS:
            if pattern.search(content):
                issues.append(
                    {
                        "code": "SENSITIVE_VALUE",
                        "message": "Prompt 疑似包含凭据或认证信息",
                    }
                )
                break
        return self._result(issues, sorted(set(variables)))

    @staticmethod
    def _load_input_schema(skill: SkillDefinition) -> dict[str, Any]:
        relative = skill.manifest.get("inputSchema")
        if not isinstance(relative, str):
            raise PromptRegistryError(
                f"Skill 输入 Schema 配置无效：{skill.skill_id}@{skill.version}"
            )
        path = (skill.root / relative).resolve()
        if skill.root.resolve() not in path.parents or not path.is_file():
            raise PromptRegistryError(
                f"Skill 输入 Schema 文件不存在：{skill.skill_id}@{skill.version}"
            )
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PromptRegistryError(
                f"Skill 输入 Schema 读取失败：{skill.skill_id}@{skill.version}"
            ) from exc
        return value if isinstance(value, dict) else {}

    @staticmethod
    def _result(issues: list[dict[str, str]], variables: list[str]) -> dict[str, Any]:
        return {"passed": not issues, "issues": issues, "variables": variables}


class PromptManagementService:
    def __init__(self, skill_root: Path, draft_root: Path):
        self.skills = SkillRegistry(skill_root)
        self.prompts = PromptRegistry(skill_root)
        self.drafts = PromptDraftStore(draft_root)
        self.validator = PromptContentValidator()
        self.skill_root = skill_root.resolve()
        self._publish_lock = threading.RLock()

    def create_draft(
        self,
        prompt_id: str,
        content: str | None,
        base_version: str | None,
        actor_id: str,
    ) -> PromptDraft:
        base = self.prompts.get(prompt_id, base_version)
        draft_content = base.content if content is None else content
        self._validate_non_empty(draft_content)
        return self.drafts.create(base, draft_content, actor_id)

    def get_draft(self, draft_id: str) -> PromptDraft:
        return self.drafts.get(draft_id)

    def update_draft(
        self,
        draft_id: str,
        content: str,
        expected_revision: int,
        actor_id: str,
    ) -> PromptDraft:
        self._validate_non_empty(content)
        return self.drafts.update(draft_id, content, expected_revision, actor_id)

    def validate_draft(self, draft_id: str) -> tuple[PromptDraft, dict[str, Any]]:
        draft = self.drafts.get(draft_id)
        skill = self.skills.get(draft.skill_id, draft.base_version)
        result = self.validator.validate(draft.content, skill)
        return self.drafts.save_validation(draft_id, result), result

    def render_test(
        self,
        draft_id: str,
        variables: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        draft = self.drafts.get(draft_id)
        skill = self.skills.get(draft.skill_id, draft.base_version)
        validation = self.validator.validate(draft.content, skill)
        supplied = variables or self._sample_variables(skill)
        return {
            "draft": draft.summary(),
            "executionMode": "render_only",
            "provider": None,
            "model": None,
            "validation": validation,
            "variables": supplied,
            "content": self._render(draft.content, supplied),
        }

    def publish_draft(
        self,
        draft_id: str,
        requested_version: str | None,
        actor_id: str,
    ) -> tuple[PromptDraft, PromptDefinition]:
        draft = self.drafts.get(draft_id)
        if draft.status == "published":
            raise PromptPublishConflictError("已发布草稿不可重复发布")
        _, validation = self.validate_draft(draft_id)
        if not validation["passed"]:
            raise PromptValidationError(validation)
        base_skill = self.skills.get(draft.skill_id, draft.base_version)
        with self._publish_lock:
            versions = [
                item.version
                for item in self.skills.list_published()
                if item.skill_id == draft.skill_id
            ]
            highest = max(versions, key=self._version_key)
            target = requested_version or self._next_patch(highest)
            self._validate_publish_version(target, highest, versions)
            self._publish_atomic(base_skill, draft.prompt_name, draft.content, target)
        published = self.prompts.get(draft.prompt_id, target)
        updated = self.drafts.mark_published(draft_id, target, actor_id)
        return updated, published

    def diff(self, prompt_id: str, version: str, from_version: str | None) -> dict[str, Any]:
        target = self.prompts.get(prompt_id, version)
        candidates = [item for item in self.prompts.list_published() if item.prompt_id == prompt_id]
        previous = None
        if from_version is not None:
            previous = self.prompts.get(prompt_id, from_version)
        else:
            lower = [
                item
                for item in candidates
                if self._version_key(item.skill_version) < self._version_key(target.skill_version)
            ]
            if lower:
                previous = max(lower, key=lambda item: self._version_key(item.skill_version))
        before = previous.content.splitlines(keepends=True) if previous else []
        after = target.content.splitlines(keepends=True)
        return {
            "promptId": prompt_id,
            "fromVersion": previous.skill_version if previous else None,
            "toVersion": target.skill_version,
            "hasPrevious": previous is not None,
            "diff": "".join(
                difflib.unified_diff(
                    before,
                    after,
                    fromfile=f"{prompt_id}@{previous.skill_version if previous else 'empty'}",
                    tofile=f"{prompt_id}@{target.skill_version}",
                )
            ),
        }

    @staticmethod
    def _validate_non_empty(content: str) -> None:
        if not isinstance(content, str) or not content.strip():
            raise PromptValidationError(
                {
                    "passed": False,
                    "issues": [{"code": "EMPTY_CONTENT", "message": "Prompt 内容不能为空"}],
                    "variables": [],
                }
            )

    @staticmethod
    def _version_key(version: str) -> tuple[int, int, int]:
        return tuple(int(part) for part in version.split("."))

    @staticmethod
    def _next_patch(version: str) -> str:
        major, minor, patch = (int(part) for part in version.split("."))
        return f"{major}.{minor}.{patch + 1}"

    @staticmethod
    def _validate_publish_version(target: str, highest: str, versions: list[str]) -> None:
        if not SEMVER.fullmatch(target):
            raise PromptPublishConflictError(f"发布版本必须是 SemVer：{target!r}")
        if target in versions or PromptManagementService._version_key(target) <= PromptManagementService._version_key(highest):
            raise PromptPublishConflictError(
                f"发布版本必须高于当前最高版本 {highest}：{target}"
            )

    def _publish_atomic(
        self,
        base_skill: SkillDefinition,
        prompt_name: str,
        content: str,
        target_version: str,
    ) -> None:
        skill_directory = self.skill_root / base_skill.skill_id
        versions_directory = skill_directory / "versions"
        versions_directory.mkdir(parents=True, exist_ok=True)
        target_directory = versions_directory / target_version
        if target_directory.exists():
            raise PromptPublishConflictError(f"目标版本已存在：{base_skill.skill_id}@{target_version}")
        temporary = versions_directory / f".{target_version}.publish-{uuid.uuid4().hex[:8]}"
        try:
            temporary.mkdir()
            for item in base_skill.root.iterdir():
                if item.name == "versions":
                    continue
                destination = temporary / item.name
                if item.is_dir():
                    shutil.copytree(item, destination)
                else:
                    shutil.copy2(item, destination)
            manifest_path = temporary / "skill.yaml"
            manifest = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                raise PromptRegistryError(f"Skill Manifest 无效：{base_skill.skill_id}")
            manifest["version"] = target_version
            manifest["status"] = "published"
            mappings = manifest.get("prompts", {})
            relative_file = mappings.get(prompt_name)
            if not isinstance(relative_file, str):
                raise PromptRegistryError(f"Prompt 映射不存在：{base_skill.skill_id}.{prompt_name}")
            prompt_path = (temporary / relative_file).resolve()
            if temporary.resolve() not in prompt_path.parents:
                raise PromptRegistryError("发布 Prompt 路径越界")
            prompt_path.write_text(content, encoding="utf-8")
            manifest_path.write_text(
                yaml.safe_dump(manifest, allow_unicode=True, sort_keys=False),
                encoding="utf-8",
            )
            temporary.replace(target_directory)
        except Exception:
            if temporary.exists():
                shutil.rmtree(temporary)
            raise

    @staticmethod
    def _sample_variables(skill: SkillDefinition) -> dict[str, Any]:
        relative = skill.manifest["inputSchema"]
        schema = json.loads((skill.root / relative).read_text(encoding="utf-8"))
        result: dict[str, Any] = {}
        for name, definition in schema.get("properties", {}).items():
            value_type = definition.get("type") if isinstance(definition, dict) else None
            if value_type == "object":
                value: Any = {}
            elif value_type == "array":
                value = []
            elif value_type in {"number", "integer"}:
                value = 0
            elif value_type == "boolean":
                value = False
            else:
                value = f"<{camel_to_snake(name)}>"
            result[camel_to_snake(name)] = value
        return result

    @staticmethod
    def _render(content: str, variables: dict[str, Any]) -> str:
        def replace(match: re.Match[str]) -> str:
            name = match.group(1).strip()
            value = variables.get(name, f"<{name}:missing>")
            if isinstance(value, (dict, list)):
                return json.dumps(value, ensure_ascii=False, sort_keys=True)
            return str(value)

        return VARIABLE_BLOCK.sub(replace, content)
