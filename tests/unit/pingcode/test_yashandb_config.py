import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "packages" / "pingcode-core"))
from yashandb_config import load_database_config


class YashanDBConfigTest(unittest.TestCase):
    def test_default_config_is_centralized(self):
        config = load_database_config(Path(__file__).resolve().parents[3])
        self.assertTrue(config["jdbc"]["url"].startswith("jdbc:yasdb:"))
        self.assertNotIn("password", config["jdbc"])

    def test_environment_overrides_defaults(self):
        config = load_database_config(
            Path(__file__).resolve().parents[3],
            {"YASDB_STORAGE_PORT": "19999", "YASDB_USERNAME": "from-env"},
        )
        self.assertEqual(19999, config["storage"]["port"])
        self.assertEqual("from-env", config["jdbc"]["username"])


if __name__ == "__main__":
    unittest.main()
