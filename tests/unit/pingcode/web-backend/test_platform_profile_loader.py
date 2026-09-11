import json
import os
import tempfile
import unittest
from pathlib import Path

from app.platform_profile.loader import ProfileError, load_profile
from app.platform_profile.runtime import RuntimeProfile


REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
VALID_MANIFEST = Path("packages/platform-contracts/enterprise-profile/v1/fixtures/valid/minimal-yashandb.json")


class PlatformProfileLoaderTest(unittest.TestCase):
    def test_default_profile_has_stable_redacted_context(self):
        result = load_profile(repository_root=REPOSITORY_ROOT, env={})
        context = dict(result["context"])
        self.assertEqual("yashandb", context["profileId"])
        self.assertRegex(context["configFingerprint"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(29, len(result["resources"]))
        self.assertEqual([
            {"configured": True, "enabled": True, "id": "local-upload", "type": "local-upload"},
            {"configured": False, "enabled": True, "id": "pingcode", "type": "pingcode"},
            {"configured": False, "enabled": True, "id": "mcp", "type": "mcp"},
        ], context["connectors"])
        self.assertNotIn(str(REPOSITORY_ROOT), json.dumps(context, ensure_ascii=False))

    def test_runtime_profile_exposes_domain_brand_and_trace_without_secrets(self):
        runtime = RuntimeProfile(load_profile(repository_root=REPOSITORY_ROOT, env={}))

        self.assertEqual("yashandb", runtime.domain_id)
        self.assertEqual("yashandb-domain:1.0.0", runtime.domain_version)
        self.assertEqual("YashanDB 知识中心", runtime.brand["productName"])
        self.assertEqual("yashandb", runtime.profile_id)
        self.assertEqual("1.0.0", runtime.profile_version)
        self.assertRegex(runtime.config_fingerprint, r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(runtime.profile_version, runtime.trace["profileVersion"])
        self.assertNotIn("token", json.dumps(dict(runtime.trace), ensure_ascii=False).lower())

    def test_explicit_invalid_selection_does_not_fallback(self):
        for profile_id in ("", "unknown", "../outside"):
            with self.subTest(profile_id=profile_id):
                with self.assertRaises(ProfileError) as raised:
                    load_profile(repository_root=REPOSITORY_ROOT, env={"KNOWLEDGE_PLATFORM_PROFILE": profile_id})
                self.assertEqual("PROFILE_NOT_FOUND", raised.exception.code)
                self.assertIn("企业能力包", raised.exception.message)

    def test_missing_resource_is_reported_without_absolute_path(self):
        with tempfile.TemporaryDirectory(prefix="kpg-profile-") as directory:
            root = Path(directory)
            schema_target = root / "packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json"
            schema_target.parent.mkdir(parents=True)
            schema_target.write_bytes((REPOSITORY_ROOT / "packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json").read_bytes())
            manifest = root / "knowledge/profiles/yashandb.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_bytes((REPOSITORY_ROOT / VALID_MANIFEST).read_bytes())
            with self.assertRaises(ProfileError) as raised:
                load_profile(repository_root=root, registry={"yashandb": "knowledge/profiles/yashandb.json"}, env={})
            self.assertEqual("PROFILE_RESOURCE_NOT_FOUND", raised.exception.code)
            self.assertNotIn(str(root), raised.exception.message)

    @unittest.skipUnless(hasattr(os, "symlink"), "当前平台不支持符号链接")
    def test_symlink_escape_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="kpg-profile-") as directory, tempfile.TemporaryDirectory(prefix="kpg-outside-") as outside:
            root = Path(directory)
            schema = root / "packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json"
            schema.parent.mkdir(parents=True)
            schema.write_bytes((REPOSITORY_ROOT / "packages/platform-contracts/enterprise-profile/v1/enterprise-profile.schema.json").read_bytes())
            target = Path(outside) / "domain.json"
            target.write_text("{}", encoding="utf-8")
            resource = root / "packages/platform-contracts/enterprise-profile/v1/fixtures/resources/domain.json"
            resource.parent.mkdir(parents=True)
            resource.symlink_to(target)
            manifest = root / VALID_MANIFEST
            manifest.parent.mkdir(parents=True)
            manifest.write_bytes((REPOSITORY_ROOT / VALID_MANIFEST).read_bytes())
            with self.assertRaises(ProfileError) as raised:
                load_profile(repository_root=root, registry={"yashandb": str(VALID_MANIFEST)}, env={})
            self.assertEqual("SYMLINK_ESCAPE", raised.exception.issue_code)


if __name__ == "__main__":
    unittest.main()
