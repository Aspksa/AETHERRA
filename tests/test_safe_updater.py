import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
import update

SHA="a"*40

class SafeUpdaterTests(unittest.TestCase):
    def test_ci_blocks_red_main(self):
        data={"check_runs":[{"name":"python-server","status":"completed","conclusion":"success"},
                            {"name":"browser-syntax","status":"completed","conclusion":"failure"}]}
        with patch.object(update,"request_bytes",return_value=json.dumps(data).encode()):
            with self.assertRaisesRegex(RuntimeError,"CI"):
                update.verify_ci(SHA)

    def test_ci_all_green(self):
        data={"check_runs":[{"name":n,"status":"completed","conclusion":"success"}
                            for n in ("python-server","browser-syntax")]}
        with patch.object(update,"request_bytes",return_value=json.dumps(data).encode()):
            update.verify_ci(SHA)

    def test_runtime_manifest_includes_new_modules(self):
        stream=io.BytesIO()
        with zipfile.ZipFile(stream,"w") as z:
            for name in update.FILES:
                z.writestr("repo/"+name,"content")
            z.writestr("repo/new_game.js","let x=1")
            z.writestr("repo/tests/test.py","no")
            z.writestr("repo/.secrets","no")
        with zipfile.ZipFile(io.BytesIO(stream.getvalue())) as z:
            files=update.runtime_files(z)
        self.assertIn("new_game.js",files)
        self.assertNotIn(".secrets",files)
        self.assertNotIn("test.py",files)

    def test_rolls_back_existing_and_removes_new_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);backup=root/".aetherra_backup";backup.mkdir()
            (backup/"index.html").write_text("old")
            (root/"index.html").write_text("new")
            (root/"new_game.js").write_text("new")
            (root/".aetherra_version").write_text("b"*40)
            (backup/"manifest.json").write_text(json.dumps({
                "files":["index.html","new_game.js"],"existing":["index.html"],"installed":"a"*40
            }))
            with patch.object(update,"BASE",root):
                update.rollback()
            self.assertEqual((root/"index.html").read_text(),"old")
            self.assertFalse((root/"new_game.js").exists())
            self.assertEqual((root/".aetherra_version").read_text(),"a"*40)

    def test_refuses_git_checkout(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/".git").mkdir()
            with patch.object(update,"BASE",root):
                with self.assertRaisesRegex(RuntimeError,"Git"):
                    update.install()

if __name__=="__main__":
    unittest.main()
