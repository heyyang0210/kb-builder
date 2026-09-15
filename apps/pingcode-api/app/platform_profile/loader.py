import hashlib
import json
import os
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PureWindowsPath
from types import MappingProxyType

from jsonschema import Draft202012Validator


DEFAULT_PROFILE_ID = "yashandb"
PROFILE_ID_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$")
SECRET_REF_PATTERN = re.compile(r"^(?:env:[A-Z][A-Z0-9_]{1,126}|secret:[a-z][a-z0-9]*(?:[./-][a-z0-9]+)*)$")
SENSITIVE_KEY = re.compile(r"^(password|token|apiKey|cookie|casTicket|secret)$", re.IGNORECASE)
ALLOWED_RESOURCE_PREFIXES = (
    "packages/platform-contracts/enterprise-profile/", "knowledge/domain/", "knowledge/skills/", "packages/agent-runner-core/lib/agents/",
    "tools/knowledge-processing/pingcode-processing/skills/", "tools/knowledge-processing/pingcode-processing/metadata-rules/",
    "knowledge/profiles/", "knowledge/prompts/", "knowledge/templates/",
    "config/knowledge-center/branding/",
)
ALLOWED_RESOURCE_FILES = {"config/knowledge-center/content-rules.json"}
CONNECTOR_REQUIRED_SECRETS = {
    "local-upload": (),
    "pingcode": ("secret:connectors/pingcode",),
    "mcp": ("secret:connectors/mcp",),
}
COLLECTIONS = (
    "modules", "workspaces", "connectors", "agents", "skills", "prompts",
    "templates", "qualityRules", "logicalDirectories", "capabilities",
)


@dataclass(frozen=True)
class ProfileError(Exception):
    code: str
    message: str
    issue_code: str | None = None
    path: str = "/"
    retryable: bool = False

    def __str__(self):
        return self.message

    def to_dict(self):
        return {"code": self.code, "message": self.message, "issueCode": self.issue_code, "path": self.path, "retryable": self.retryable}


def fail(code, message, issue_code, config_path):
    raise ProfileError(code, message, issue_code, config_path)


def normalize(value):
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize(value[key]) for key in sorted(value)}
    return value


def canonical_json(value):
    return json.dumps(normalize(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def validate_semantics(profile):
    def walk(value, pointer=""):
        if isinstance(value, dict):
            for key, child in value.items():
                child_path = f"{pointer}/{key}"
                if SENSITIVE_KEY.match(key):
                    fail("PROFILE_SECRET_EXPOSED", "企业能力包包含禁止的敏感字段", "SECRET_FIELD", child_path)
                walk(child, child_path)
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{pointer}/{index}")
    walk(profile)

    for collection in COLLECTIONS:
        seen = set()
        for index, item in enumerate(profile.get(collection, [])):
            if item["id"] in seen:
                fail("PROFILE_VALIDATION_FAILED", "资源标识重复", "REFERENCE_DUPLICATE", f"/{collection}/{index}/id")
            seen.add(item["id"])
    workspace_ids = {item["id"] for item in profile.get("workspaces", [])}
    for index, module in enumerate(profile.get("modules", [])):
        if module["workspaceRef"] not in workspace_ids:
            fail("PROFILE_VALIDATION_FAILED", "工作区引用不存在", "REFERENCE_UNKNOWN", f"/modules/{index}/workspaceRef")
    capability_ids = {item["id"] for item in profile.get("capabilities", [])}
    for connector_index, connector in enumerate(profile.get("connectors", [])):
        for ref_index, reference in enumerate(connector["capabilityRefs"]):
            if reference not in capability_ids:
                fail("PROFILE_VALIDATION_FAILED", "能力引用不存在", "REFERENCE_UNKNOWN", f"/connectors/{connector_index}/capabilityRefs/{ref_index}")
        for ref_index, reference in enumerate(connector["secretRefs"]):
            if not SECRET_REF_PATTERN.match(reference):
                fail("PROFILE_VALIDATION_FAILED", "密钥引用格式不正确", "SCHEMA_INVALID", f"/connectors/{connector_index}/secretRefs/{ref_index}")
        required = CONNECTOR_REQUIRED_SECRETS.get(connector["type"])
        if required is None or any(reference not in connector["secretRefs"] for reference in required):
            fail("PROFILE_VALIDATION_FAILED", "连接器缺少最低密钥引用", "CONNECTOR_SECRET_REQUIRED", f"/connectors/{connector_index}/secretRefs")


def collect_resource_refs(profile):
    refs = [(profile["domain"]["manifestRef"], "/domain/manifestRef")]
    icon_ref = profile.get("brand", {}).get("icon", {}).get("resourceRef")
    if icon_ref:
        refs.append((icon_ref, "/brand/icon/resourceRef"))
    for collection, field in (("agents", "manifestRef"), ("skills", "manifestRef"), ("prompts", "resourceRef"), ("templates", "resourceRef"), ("qualityRules", "resourceRef")):
        refs.extend((item[field], f"/{collection}/{index}/{field}") for index, item in enumerate(profile[collection]))
    return sorted(refs, key=lambda item: item[0])


def resolve_resources(profile, repository_root):
    root_real = repository_root.resolve(strict=True)
    resources = []
    for reference, config_path in collect_resource_refs(profile):
        windows = PureWindowsPath(reference)
        parts = reference.split("/")
        if windows.is_absolute() or reference.startswith(("/", "\\\\", "~")):
            fail("PROFILE_PATH_FORBIDDEN", "资源引用不在允许范围内", "ABSOLUTE_PATH", config_path)
        if "\\" in reference or "" in parts or "." in parts or ".." in parts or (reference not in ALLOWED_RESOURCE_FILES and not reference.startswith(ALLOWED_RESOURCE_PREFIXES)):
            fail("PROFILE_PATH_FORBIDDEN", "资源引用不在允许范围内", "PATH_OUT_OF_ROOT", config_path)
        candidate = repository_root / reference
        try:
            real = candidate.resolve(strict=True)
        except (FileNotFoundError, OSError):
            fail("PROFILE_RESOURCE_NOT_FOUND", "能力包引用的资源不存在", "RESOURCE_NOT_FOUND", config_path)
        if root_real not in real.parents:
            fail("PROFILE_PATH_FORBIDDEN", "资源真实路径越过仓库边界", "SYMLINK_ESCAPE", config_path)
        if not real.is_file():
            fail("PROFILE_VALIDATION_FAILED", "资源引用必须指向普通文件", "RESOURCE_NOT_FILE", config_path)
        resources.append({"reference": reference, "digest": hashlib.sha256(real.read_bytes()).hexdigest(), "path": real})
    return resources


def build_context(profile, resources, env, secret_resolver=None):
    fingerprint_resources = [{"reference": item["reference"], "digest": item["digest"]} for item in resources]
    digest = hashlib.sha256(canonical_json({"profile": profile, "resources": fingerprint_resources}).encode("utf-8")).hexdigest()
    connectors = []
    for connector in profile["connectors"]:
        configured = all(
            bool(env.get(reference[4:])) if reference.startswith("env:")
            else bool(secret_resolver and secret_resolver(reference[7:]))
            for reference in connector["secretRefs"]
        )
        connectors.append({"id": connector["id"], "type": connector["type"], "enabled": connector["enabled"], "configured": configured})
    context = {
        "schemaVersion": profile["apiVersion"], "profileId": profile["metadata"]["id"],
        "enterpriseId": profile["metadata"]["enterpriseId"], "displayName": profile["metadata"]["displayName"],
        "brand": profile["brand"], "capabilities": profile["capabilities"],
        "workspaces": [{key: item[key] for key in ("id", "displayName", "basePath")} for item in profile["workspaces"]],
        "connectors": connectors, "configFingerprint": f"sha256:{digest}",
        "generationPolicies": [{key: item[key] for key in ("id", "version", "displayName", "documentTypes", "generationModes")} for item in profile.get("generationPolicies", []) if item.get("enabled")],
    }
    return MappingProxyType(normalize(context))


def load_profile(repository_root=None, registry=None, env=None, profile_id=None, secret_resolver=None):
    repository_root = Path(repository_root or Path(__file__).resolve().parents[4]).resolve()
    registry = registry or {"yashandb": "config/knowledge-center/product.json"}
    env = os.environ if env is None else env
    explicitly_set = "KNOWLEDGE_PLATFORM_PROFILE" in env
    selected = profile_id if profile_id is not None else (env.get("KNOWLEDGE_PLATFORM_PROFILE") if explicitly_set else DEFAULT_PROFILE_ID)
    if not selected or not PROFILE_ID_PATTERN.match(selected):
        fail("PROFILE_NOT_FOUND", "企业能力包选择无效", "PROFILE_ID_INVALID", "/")
    manifest_ref = registry.get(selected)
    if not manifest_ref:
        fail("PROFILE_NOT_FOUND", "未找到登记的企业能力包", "PROFILE_ID_UNKNOWN", "/")
    manifest_path = repository_root / manifest_ref
    try:
        profile = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail("PROFILE_NOT_FOUND", "企业能力包文件不存在或不可读", "PROFILE_FILE_UNREADABLE", "/")
    except (UnicodeDecodeError, json.JSONDecodeError):
        fail("PROFILE_PARSE_FAILED", "企业能力包不是有效 JSON", "JSON_PARSE_FAILED", "/")

    schema_path = repository_root / "packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(profile), key=lambda error: list(error.absolute_path))
    if errors:
        first = errors[0]
        config_path = "/" + "/".join(str(part) for part in first.absolute_path)
        code = "PROFILE_VERSION_UNSUPPORTED" if profile.get("apiVersion") not in (None, "enterprise-profile/v1") else "PROFILE_VALIDATION_FAILED"
        fail(code, "企业能力包结构校验失败", "SCHEMA_INVALID", config_path)
    validate_semantics(profile)
    resources = resolve_resources(profile, repository_root)
    return {"profile": normalize(profile), "context": build_context(profile, resources, env, secret_resolver), "resources": resources}
