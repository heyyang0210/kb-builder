import unittest

from fastapi.testclient import TestClient

from app.config import runtime_profile, settings
from app.main import app
from app.markdown_cleaning import clean_markdown


class MaterialProcessingProfileTest(unittest.TestCase):
    def test_registered_skill_root_and_domain_are_selected(self):
        self.assertEqual("yashandb", runtime_profile.domain_id)
        self.assertEqual("yashandb-domain:1.0.0", runtime_profile.domain_version)
        self.assertEqual("skills", settings.processing_skill_root.name)
        self.assertEqual("skill.yaml", runtime_profile.resource("skills", "knowledge-point-extraction").name)

    def test_cleaning_reason_uses_profile_brand(self):
        result = clean_markdown("## Source files\n- `src/module/example.c`\n")
        reasons = [item.get("reason", "") for item in result.normalization_events]
        self.assertTrue(any(runtime_profile.brand["enterpriseName"] in reason for reason in reasons))

    def test_runtime_config_exposes_only_brand_projection(self):
        response = TestClient(app).get("/api/system/runtime-config")
        self.assertEqual(200, response.status_code)
        payload = response.json()
        self.assertEqual(runtime_profile.brand, payload["brand"])
        self.assertNotIn("configFingerprint", payload)
        self.assertNotIn("profile", payload)
        serialized = response.text
        self.assertNotIn(str(settings.data_root), serialized)
        self.assertNotIn("secret:", serialized)

    def test_platform_context_matches_redacted_profile_projection(self):
        response = TestClient(app).get("/api/platform/context")
        self.assertEqual(200, response.status_code)
        self.assertEqual(dict(runtime_profile.context), response.json())
        serialized = response.text
        self.assertNotIn(str(settings.data_root), serialized)
        self.assertNotIn("secret:", serialized)
        self.assertNotIn("token", serialized.lower())


if __name__ == "__main__":
    unittest.main()
