import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools import sync_legal_shell


class LegalShellSyncTests(unittest.TestCase):
    def sample_page(self):
        return """<!DOCTYPE html>
<html>
<body>
  <!-- LEGAL-SHELL:HEADER:start -->
  <header>Old header</header>
  <!-- LEGAL-SHELL:HEADER:end -->
  <main>Body</main>
  <!-- LEGAL-SHELL:FOOTER:start -->
  <footer>Old footer</footer>
  <!-- LEGAL-SHELL:FOOTER:end -->
</body>
</html>
"""

    def replacements(self):
        return {
            "HEADER": "  <header>Shared header</header>\n",
            "FOOTER": "  <footer>Shared footer</footer>\n",
        }

    def test_sync_text_replaces_both_shared_blocks(self):
        synced = sync_legal_shell.sync_text(self.sample_page(), self.replacements())
        self.assertIn("<header>Shared header</header>", synced)
        self.assertIn("<footer>Shared footer</footer>", synced)
        self.assertNotIn("Old header", synced)
        self.assertNotIn("Old footer", synced)
        self.assertIn(sync_legal_shell.marker("HEADER", "start"), synced)
        self.assertIn(sync_legal_shell.marker("FOOTER", "end"), synced)

    def test_missing_marker_raises_clear_error(self):
        with self.assertRaises(ValueError):
            sync_legal_shell.sync_text("<body></body>", self.replacements())

    def test_check_mode_reports_stale_pages_without_writing(self):
        with tempfile.TemporaryDirectory() as tmp:
            page = Path(tmp) / "privacy.html"
            page.write_text(self.sample_page(), encoding="utf-8")
            with patch.object(sync_legal_shell, "page_blocks", return_value=self.replacements()):
                stale = sync_legal_shell.sync_pages([page], check=True)
                self.assertEqual(stale, [page])
                self.assertIn("Old header", page.read_text(encoding="utf-8"))

    def test_write_mode_updates_page_and_then_checks_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            page = Path(tmp) / "privacy.html"
            page.write_text(self.sample_page(), encoding="utf-8")
            with patch.object(sync_legal_shell, "page_blocks", return_value=self.replacements()):
                self.assertEqual(sync_legal_shell.sync_pages([page], check=False), [])
                updated = page.read_text(encoding="utf-8")
                self.assertIn("Shared header", updated)
                self.assertIn("Shared footer", updated)
                self.assertEqual(sync_legal_shell.sync_pages([page], check=True), [])


if __name__ == "__main__":
    unittest.main()
