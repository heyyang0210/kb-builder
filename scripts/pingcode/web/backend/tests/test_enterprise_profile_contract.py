import copy
import json
import re
import unittest
from pathlib import Path, PurePosixPath, PureWindowsPath

from jsonschema import Draft202012Validator


REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
CONTRACT_ROOT = REPOSITORY_ROOT / "contracts" / "enterprise-profile" / "v1"
SCHEMA = json.loads((CONTRACT_ROOT / "enterprise-profile.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA)
SENSITIVE_KEY = re.compile(r"^(password|token|apiKey|cookie|casTicket|secret)$", re.IGNORECASE)


def set_json_pointer(target, pointer, value):
    parts = [part.replace("~1", "/").replace("~0", "~") for part in pointer.split("/")[1:]]
    parent = target
    for part in parts[:-1]:
        parent = parent[part]
    parent[parts[-1]] = value


def load_fixture(relative_path):
    fixture_path = CONTRACT_ROOT / "fixtures" / relative_path
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    if "extends" not in fixture:
        return fixture
    base = json.loads((fixture_path.parent / fixture["extends"]).resolve().read_text(encoding="utf-8"))
    profile = copy.deepcopy(base)
    set_json_pointer(profile, fixture["mutation"]["path"], fixture["mutation"]["value"])
    return profile


def fixture_expectation(relative_path):
    fixture = json.loads((CONTRACT_ROOT / "fixtures" / relative_path).read_text(encoding="utf-8"))
    return fixture["expectedCode"], fixture["expectedIssueCode"]


def resource_references(profile):
    references = [profile.get("domain", {}).get("manifestRef")]
    for collection, field in (
        ("agents", "manifestRef"),
        ("skills", "manifestRef"),
        ("prompts", "resourceRef"),
        ("templates", "resourceRef"),
        ("qualityRules", "resourceRef"),
    ):
        references.extend(item.get(field) for item in profile.get(collection, []))
    return [reference for reference in references if reference]


def validate_semantics(profile):
    def walk(value, pointer=""):
        if isinstance(value, dict):
            for key, child in value.items():
                child_pointer = f"{pointer}/{key}"
                if SENSITIVE_KEY.match(key):
                    return {"code": "PROFILE_SECRET_EXPOSED", "issueCode": "SECRET_FIELD", "path": child_pointer}
                found = walk(child, child_pointer)
                if found:
                    return found
        elif isinstance(value, list):
            for index, child in enumerate(value):
                found = walk(child, f"{pointer}/{index}")
                if found:
                    return found
        return None

    secret_error = walk(profile)
    if secret_error:
        return secret_error

    for reference in resource_references(profile):
        windows_path = PureWindowsPath(reference)
        if PurePosixPath(reference).is_absolute() or windows_path.is_absolute() or reference.startswith("\\\\"):
            return {"code": "PROFILE_PATH_FORBIDDEN", "issueCode": "ABSOLUTE_PATH", "path": "/resourceRef"}
        if ".." in re.split(r"[\\/]", reference):
            return {"code": "PROFILE_PATH_FORBIDDEN", "issueCode": "PATH_OUT_OF_ROOT", "path": "/resourceRef"}

    collections = (
        "modules", "workspaces", "connectors", "agents", "skills", "prompts",
        "templates", "qualityRules", "logicalDirectories", "capabilities",
    )
    for collection in collections:
        seen = set()
        for index, item in enumerate(profile.get(collection, [])):
            if item["id"] in seen:
                return {"code": "PROFILE_VALIDATION_FAILED", "issueCode": "REFERENCE_DUPLICATE", "path": f"/{collection}/{index}/id"}
            seen.add(item["id"])

    workspace_ids = {item["id"] for item in profile.get("workspaces", [])}
    for index, module in enumerate(profile.get("modules", [])):
        if module["workspaceRef"] not in workspace_ids:
            return {"code": "PROFILE_VALIDATION_FAILED", "issueCode": "REFERENCE_UNKNOWN", "path": f"/modules/{index}/workspaceRef"}
    capability_ids = {item["id"] for item in profile.get("capabilities", [])}
    for connector_index, connector in enumerate(profile.get("connectors", [])):
        for ref_index, reference in enumerate(connector["capabilityRefs"]):
            if reference not in capability_ids:
                return {
                    "code": "PROFILE_VALIDATION_FAILED",
                    "issueCode": "REFERENCE_UNKNOWN",
                    "path": f"/connectors/{connector_index}/capabilityRefs/{ref_index}",
                }
    return None


def validate_profile(profile):
    semantic_error = validate_semantics(profile)
    if semantic_error:
        return semantic_error
    errors = sorted(VALIDATOR.iter_errors(profile), key=lambda error: list(error.absolute_path))
    if errors:
        first = errors[0]
        path = "/" + "/".join(str(part) for part in first.absolute_path)
        return {
            "code": "PROFILE_VERSION_UNSUPPORTED"
            if profile.get("apiVersion") not in (None, "enterprise-profile/v1")
            else "PROFILE_VALIDATION_FAILED",
            "issueCode": "SCHEMA_INVALID",
            "path": path,
        }
    return None


class EnterpriseProfileContractTest(unittest.TestCase):
    def test_minimal_yashandb_profile_is_valid(self):
        self.assertIsNone(validate_profile(load_fixture("valid/minimal-yashandb.json")))

    def test_invalid_fixtures_have_stable_codes_and_paths(self):
        fixtures = (
            "invalid/missing-required.json",
            "invalid/absolute-path.json",
            "invalid/path-traversal.json",
            "invalid/plaintext-secret.json",
            "invalid/duplicate-id.json",
            "invalid/unknown-reference.json",
            "invalid/unsupported-version.json",
            "invalid/unknown-field.json",
            "invalid/windows-path.json",
            "invalid/unc-path.json",
            "invalid/illegal-secret-reference.json",
        )
        for fixture in fixtures:
            with self.subTest(fixture=fixture):
                expected_code, expected_issue_code = fixture_expectation(fixture)
                error = validate_profile(load_fixture(fixture))
                self.assertEqual(expected_code, error["code"])
                self.assertEqual(expected_issue_code, error["issueCode"])
                self.assertTrue(error["path"].startswith("/"))


if __name__ == "__main__":
    unittest.main()
