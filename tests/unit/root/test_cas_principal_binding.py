import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
PRINCIPAL_REPOSITORY = REPOSITORY_ROOT / "apps" / "yashandb-storage" / "src" / "PrincipalRepository.java"
STORAGE_MAIN = REPOSITORY_ROOT / "apps" / "yashandb-storage" / "src" / "Main.java"


class CasPrincipalBindingContractTests(unittest.TestCase):
    def test_first_login_uses_yashandb_compatible_timestamp_assignment(self):
        source = PRINCIPAL_REPOSITORY.read_text(encoding="utf-8")
        self.assertIn("CAS_LOGIN_NAME=?, FIRST_LOGIN_AT=CURRENT_TIMESTAMP", source)
        self.assertNotIn("FIRST_LOGIN_AT=COALESCE(FIRST_LOGIN_AT, CURRENT_TIMESTAMP)", source)

    def test_interactive_login_does_not_create_missing_or_ambiguous_principal(self):
        source = PRINCIPAL_REPOSITORY.read_text(encoding="utf-8")
        self.assertIn('throw new SQLException("CAS_PRINCIPAL_NOT_FOUND")', source)
        self.assertIn('throw new SQLException("CAS_PRINCIPAL_AMBIGUOUS")', source)
        self.assertIn("syncCasLogin(connection, loginName, displayName, actor, false)", source)
        self.assertIn("syncCasLogin(connection, login, name, actor, true)", source)

    def test_binding_errors_are_exposed_as_conflicts(self):
        source = STORAGE_MAIN.read_text(encoding="utf-8")
        self.assertIn('code.startsWith("CAS_PRINCIPAL_") ? 409', source)


if __name__ == "__main__":
    unittest.main()
