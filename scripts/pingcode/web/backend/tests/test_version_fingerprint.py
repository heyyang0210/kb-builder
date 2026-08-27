import copy
import unittest

from app.version_fingerprint import VersionFingerprint


class VersionFingerprintTests(unittest.TestCase):
    def test_build_is_canonical_for_all_enabled_components(self):
        left = VersionFingerprint.build(
            {"graphVersionId": "g1", "counts": {"nodes": 2, "edges": 1}},
            {"indexVersionId": "i1", "shards": [1, 2]},
            {"rulesVersion": "r1", "options": {"b": 2, "a": 1}},
            {"provider": "local", "model": "m1"},
            {"provider": "local", "model": "e1"},
        )
        right = VersionFingerprint.build(
            {"counts": {"edges": 1, "nodes": 2}, "graphVersionId": "g1"},
            {"shards": [1, 2], "indexVersionId": "i1"},
            {"options": {"a": 1, "b": 2}, "rulesVersion": "r1"},
            {"model": "m1", "provider": "local"},
            {"model": "e1", "provider": "local"},
        )

        self.assertEqual(left, right)
        self.assertTrue(VersionFingerprint.verify(left))
        self.assertEqual(set(left["status"].values()), {"available"})

    def test_disabled_model_and_embedding_are_explicitly_not_applicable(self):
        result = VersionFingerprint.build("graph-v1", "index-v1", "rules-v1")

        self.assertIsNone(result["modelVersion"])
        self.assertIsNone(result["embeddingVersion"])
        self.assertEqual(result["status"]["model"], "not_applicable")
        self.assertEqual(result["status"]["embedding"], "not_applicable")
        self.assertTrue(VersionFingerprint.verify(result))

    def test_one_component_change_changes_composite_fingerprint(self):
        first = VersionFingerprint.build("graph-v1", "index-v1", "rules-v1")
        second = VersionFingerprint.build("graph-v2", "index-v1", "rules-v1")
        self.assertNotEqual(
            first["graphVersion"], second["graphVersion"]
        )
        self.assertNotEqual(
            first["versionFingerprint"], second["versionFingerprint"]
        )

    def test_required_components_cannot_be_not_applicable(self):
        with self.assertRaisesRegex(ValueError, "graph"):
            VersionFingerprint.build(None, "index-v1", "rules-v1")

    def test_verify_rejects_tampered_fingerprint_and_false_optional_status(self):
        result = VersionFingerprint.build("graph-v1", "index-v1", "rules-v1")
        tampered = copy.deepcopy(result)
        tampered["graphVersion"]["digest"] = "0" * 64
        self.assertFalse(VersionFingerprint.verify(tampered))

        false_model = copy.deepcopy(result)
        false_model["status"]["model"] = "available"
        self.assertFalse(VersionFingerprint.verify(false_model))


if __name__ == "__main__":
    unittest.main()
