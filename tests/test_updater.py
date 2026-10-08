import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import zipfile

import update


class UpdaterTests(unittest.TestCase):
    def test_manifest_validation_keeps_existing_files(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "index.html").write_text("ORIGINAL", encoding="utf-8")
            archive = io.BytesIO()
            with zipfile.ZipFile(archive, "w") as z:
                z.writestr("AETHERRA-test/index.html", "bad")
            with patch.object(update, "BASE", root), patch.object(update, "latest_commit", return_value=("a" * 40, "test")), patch.object(update, "request_bytes", return_value=archive.getvalue()), patch.object(update, "verify_ci"):
                with self.assertRaises(ValueError):
                    update.install()
            self.assertEqual((root / "index.html").read_text(encoding="utf-8"), "ORIGINAL")

    def test_no_download_when_up_to_date(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(update, "BASE", Path(temp)), patch.object(update, "latest_commit", return_value=("a" * 40, "test")), patch.object(update, "local_sha", return_value="a" * 40), patch.object(update, "request_bytes") as download:
                self.assertEqual(update.install(), "Already up to date")
                download.assert_not_called()


if __name__ == "__main__":
    unittest.main()
