"""Portable GitHub updater for AETHERRA. Standard library only.

Downloads the public main branch, stages and validates required files,
keeps a rollback copy, and never overwrites user data.
"""
import io
import json
import os
import subprocess
from pathlib import Path
import shutil
import sys
import tempfile
import time
from urllib.request import Request, urlopen
import zipfile
from urllib.error import HTTPError, URLError
from xml.etree import ElementTree

BASE = Path(__file__).resolve().parent
REPO = "Aspksa/AETHERRA"
API = f"https://api.github.com/repos/{REPO}/commits/main"
ARCHIVE = f"https://github.com/{REPO}/archive/refs/heads/main.zip"
FILES = ("index.html", "server.py", "AETHERRA.bat", "README.md",
         "update.py", "UPDATE_AETHERRA.bat", "cloudru.py")
MAX_ZIP = 20 * 1024 * 1024


def request_bytes(url, maximum=MAX_ZIP):
    req = Request(url, headers={"User-Agent": "AETHERRA-Updater/0.1",
                                "Accept": "application/vnd.github+json"})
    with urlopen(req, timeout=25) as response:
        size = response.headers.get("Content-Length")
        if size and int(size) > maximum:
            raise ValueError("Download exceeds size limit")
        data = response.read(maximum + 1)
        if len(data) > maximum:
            raise ValueError("Download exceeds size limit")
        return data


def remote_sha():
    return json.loads(request_bytes(API, 1024 * 1024).decode("utf-8"))["sha"]


def local_sha():
    path = BASE / ".aetherra_version"
    return path.read_text(encoding="ascii").strip() if path.exists() else None


def latest_commit():
    """Use GitHub API first, public Atom feed when API is blocked/rate-limited."""
    try:
        data = json.loads(request_bytes(API, 1024 * 1024).decode("utf-8"))
        return data["sha"], data.get("commit", {}).get("message", "").strip()
    except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError) as api_error:
        try:
            feed = request_bytes(f"https://github.com/{REPO}/commits/main.atom", 1024 * 1024)
            root = ElementTree.fromstring(feed)
            ns = {"a": "http://www.w3.org/2005/Atom"}
            entry = root.find("a:entry", ns)
            if entry is None:
                raise ValueError("empty commit feed")
            link = entry.find("a:link", ns)
            href = link.get("href", "") if link is not None else ""
            sha = href.rstrip("/").rsplit("/", 1)[-1]
            if len(sha) != 40 or any(c not in "0123456789abcdef" for c in sha.lower()):
                raise ValueError("invalid commit ID in feed")
            title = entry.findtext("a:title", default="", namespaces=ns).strip()
            return sha, title
        except Exception:
            if isinstance(api_error, HTTPError):
                if api_error.code in (403, 429):
                    raise RuntimeError("GitHub ограничил запросы или доступ (HTTP %s). Повторите позже или проверьте сеть." % api_error.code) from None
                raise RuntimeError("GitHub вернул HTTP %s" % api_error.code) from None
            if isinstance(api_error, (URLError, TimeoutError, OSError)):
                raise RuntimeError("Не удаётся подключиться к GitHub. Проверьте интернет, DNS, прокси или антивирус.") from None
            raise RuntimeError("GitHub вернул неожиданные данные") from None


def check():
    sha, message = latest_commit()
    installed = local_sha()
    return {"installed": installed, "latest": sha,
            "update_available": installed != sha,
            "current_version": installed[:12] if installed else "не определена",
            "latest_version": sha[:12],
            "description": message.splitlines()[0][:240] if message else "Изменения в main",
            "release_notes": message[:2000],
            "source": f"https://github.com/{REPO}/commit/{sha}"}


def install():
    sha = remote_sha()
    if sha == local_sha():
        return "Already up to date"
    # Pin archive to verified GitHub commit rather than downloading changing main.
    archive_url = f"https://github.com/{REPO}/archive/{sha}.zip"
    data = request_bytes(archive_url)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        members = {Path(name).name: name for name in z.namelist()
                   if len(Path(name).parts) == 2 and not name.endswith("/")}
        if any(f not in members for f in FILES):
            raise ValueError("Incomplete update archive")
        with tempfile.TemporaryDirectory(prefix="aetherra-update-") as tmp:
            temp = Path(tmp)
            for filename in FILES:
                payload = z.read(members[filename])
                if len(payload) > 5 * 1024 * 1024:
                    raise ValueError("File too large: " + filename)
                (temp / filename).write_bytes(payload)
            compile((temp / "server.py").read_bytes(), "server.py", "exec")
            compile((temp / "update.py").read_bytes(), "update.py", "exec")
            html = (temp / "index.html").read_text(encoding="utf-8")
            if "<canvas" not in html or "</html>" not in html:
                raise ValueError("Invalid game page")
            # Preserve a single previous version and restore on failure.
            backup = BASE / ".aetherra_backup"
            backup.mkdir(exist_ok=True)
            for filename in FILES:
                current = BASE / filename
                old = backup / filename
                if current.exists():
                    shutil.copy2(current, old)
            changed = []
            try:
                for filename in FILES:
                    os.replace(temp / filename, BASE / filename)
                    changed.append(filename)
                (BASE / ".aetherra_version").write_text(sha, encoding="ascii")
            except Exception:
                for filename in reversed(changed):
                    old = backup / filename
                    if old.exists():
                        shutil.copy2(old, BASE / filename)
                raise
    return "Installed: " + sha[:12]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "install"
    try:
        if mode == "install-restart":
            time.sleep(2)
            try:
                print(install())
            except Exception as exc:
                print("Update failed; restoring current launcher:", exc, file=sys.stderr)
            if sys.platform == "win32":
                subprocess.Popen(["cmd", "/c", str(BASE / "AETHERRA.bat")], cwd=str(BASE), creationflags=subprocess.CREATE_NEW_CONSOLE)
            else:
                subprocess.Popen([sys.executable, str(BASE / "server.py")], cwd=str(BASE), start_new_session=True)
        elif mode == "check":
            print(json.dumps(check()))
        elif mode == "install":
            print(install())
        else:
            raise ValueError("Expected check or install")
        return 0
    except Exception as exc:
        print("Update failed:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
