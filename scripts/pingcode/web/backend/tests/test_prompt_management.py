import tempfile
import unittest
import shutil
from pathlib import Path

from app.prompt_management import (
    PromptDraftConflictError,
    PromptManagementService,
    PromptPublishConflictError,
    PromptValidationError,
)


class PromptManagementTests(unittest.TestCase):
    def test_repository_prompt_can_validate_and_render_without_provider(self):
        """新架构：使用临时 skill 进行测试"""
        root = self._write_skill_root()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        with tempfile.TemporaryDirectory() as directory:
            service = PromptManagementService(root, Path(directory))
            draft = service.create_draft(
                "demo-skill.system",
                None,
                None,
                "tester",
            )
            updated, validation = service.validate_draft(draft.draft_id)
            self.assertTrue(validation["passed"])
            self.assertEqual(updated.status, "validated")
            preview = service.render_test(
                draft.draft_id,
                {
                    "context_envelope": "{\"document\":{\"sourcePath\":\"docs/example.md\"},\"currentChunk\":{\"evidenceText\":\"YAS-0001\"}}",
                },
            )
            self.assertEqual(preview["executionMode"], "render_only")
            self.assertIsNone(preview["provider"])

    def test_validation_rejects_undeclared_variable_and_secret(self):
        root = self._write_skill_root()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        with tempfile.TemporaryDirectory() as directory:
            service = PromptManagementService(root, Path(directory))
            draft = service.create_draft(
                "demo-skill.system",
                "正文 {{unknown_value}} api_key=sk-123456789012345",
                None,
                "tester",
            )
            _, validation = service.validate_draft(draft.draft_id)
            self.assertFalse(validation["passed"])
            codes = {issue["code"] for issue in validation["issues"]}
            self.assertIn("UNDECLARED_VARIABLE", codes)
            self.assertIn("SENSITIVE_VALUE", codes)
            with self.assertRaises(PromptValidationError):
                service.publish_draft(draft.draft_id, None, "tester")

    def test_update_requires_current_revision(self):
        root = self._write_skill_root()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        with tempfile.TemporaryDirectory() as directory:
            service = PromptManagementService(root, Path(directory))
            draft = service.create_draft("demo-skill.system", "旧内容", None, "tester")
            updated = service.update_draft(draft.draft_id, "新内容", 1, "tester")
            self.assertEqual(updated.revision, 2)
            with self.assertRaises(PromptDraftConflictError):
                service.update_draft(draft.draft_id, "覆盖内容", 1, "other")
            self.assertEqual(service.get_draft(draft.draft_id).content, "新内容")

    def test_publish_creates_new_immutable_skill_version_and_diff(self):
        root = self._write_skill_root()
        self.addCleanup(shutil.rmtree, root, ignore_errors=True)
        with tempfile.TemporaryDirectory() as directory:
            service = PromptManagementService(root, Path(directory))
            draft = service.create_draft(
                "demo-skill.system",
                "新内容 {{content}}",
                None,
                "tester",
            )
            published_draft, published = service.publish_draft(draft.draft_id, None, "tester")
            self.assertEqual(published_draft.status, "published")
            self.assertEqual(published.skill_version, "1.0.1")
            self.assertEqual(published.content, "新内容 {{content}}")
            self.assertEqual(
                service.prompts.get("demo-skill.system", "1.0.0").content,
                "旧内容",
            )
            diff = service.diff("demo-skill.system", "1.0.1", None)
            self.assertTrue(diff["hasPrevious"])
            self.assertIn("新内容", diff["diff"])
            self.assertFalse(any(".publish-" in item.name for item in (root / "demo-skill" / "versions").iterdir()))

            with self.assertRaises(PromptPublishConflictError):
                service.publish_draft(draft.draft_id, "1.0.1", "tester")
            with self.assertRaises(PromptDraftConflictError):
                service.update_draft(draft.draft_id, "再次修改", 1, "tester")

    @staticmethod
    def _write_skill_root() -> Path:
        root = Path(tempfile.mkdtemp())
        skill = root / "demo-skill" / "versions" / "1.0.0"
        (skill / "schemas").mkdir(parents=True)
        (skill / "prompts").mkdir()
        (skill / "SKILL.md").write_text("# demo", encoding="utf-8")
        (skill / "prompts/system.md").write_text("旧内容", encoding="utf-8")
        (skill / "schemas/input.json").write_text(
            '{"type":"object","properties":{"content":{"type":"string"}}}',
            encoding="utf-8",
        )
        (skill / "schemas/output.json").write_text("{}", encoding="utf-8")
        (skill / "skill.yaml").write_text(
            "id: demo-skill\nversion: 1.0.0\nstatus: published\n"
            "capability: chat\ninputSchema: schemas/input.json\n"
            "outputSchema: schemas/output.json\n"
            "prompts:\n  system: prompts/system.md\n",
            encoding="utf-8",
        )
        return root


if __name__ == "__main__":
    unittest.main()
