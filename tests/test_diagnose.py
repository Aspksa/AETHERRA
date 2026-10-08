import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import diagnose


class DiagnosticTests(unittest.TestCase):
    def test_detects_missing_game_files(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(diagnose.shutil, "which", return_value=None):
                report = diagnose.diagnose(directory)
            self.assertFalse(report["ready_offline"])
            self.assertFalse(report["ready_server"])
            self.assertFalse(report["files"]["index.html"])

    def test_detects_offline_ready(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "index.html").write_text("<html></html>")
            with patch.object(diagnose.shutil, "which", return_value=None):
                report = diagnose.diagnose(directory)
            self.assertTrue(report["ready_offline"])
            self.assertFalse(report["ready_server"])

    def test_report_does_not_expose_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(diagnose.shutil, "which", return_value=None):
                report = diagnose.diagnose(directory)
            self.assertNotIn("environment", report)
            self.assertNotIn("full_path", report)


if __name__ == "__main__":
    unittest.main()
