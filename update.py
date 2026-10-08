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
import socket
from urllib.request import urlopen as health_urlopen
from urllib.request import Request, urlopen
import zipfile
from urllib.error import HTTPError, URLError
from xml.etree import ElementTree

BASE = Path(__file__).resolve().parent
REPO = "Aspksa/AETHERRA"
API = f"https://api.github.com/repos/{REPO}/commits/main"
ARCHIVE = f"https://github.com/{REPO}/archive/refs/heads/main.zip"
FILES = ("index.html", "server.py", "AETHERRA.bat", "README.md",
         "update.py", "UPDATE_AETHERRA.bat", "cloudru.py",
         "diagnose.py", "DIAGNOSE_AETHERRA.bat", "PLAY_OFFLINE.bat", "AETHERRA_START.ps1")
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


def verify_ci(sha):
    """Fail closed unless both required jobs succeeded on this exact commit."""
    url = f"https://api.github.com/repos/{REPO}/commits/{sha}/check-runs?per_page=100"
    try:
        data = json.loads(request_bytes(url, 1024 * 1024).decode("utf-8"))
    except HTTPError as exc:
        if exc.code in (403, 429):
            raise RuntimeError("GitHub API ограничил проверку CI (HTTP %s). Версия найдена, но без подтверждения зелёных тестов установка безопасно заблокирована. Попробуйте позже." % exc.code) from None
        raise RuntimeError("Не удалось проверить обязательные тесты GitHub: HTTP %s" % exc.code) from None
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        raise RuntimeError("Не удалось проверить обязательные тесты GitHub. Установка заблокирована; повторите при работающем соединении.") from None
    results = {}
    for item in data.get("check_runs", []):
        name = item.get("name")
        if name in ("python-server", "browser-syntax"):
            results[name] = item.get("status") == "completed" and item.get("conclusion") == "success"
    if not all(results.get(n) is True for n in ("python-server", "browser-syntax")):
        raise RuntimeError("Обновление заблокировано: GitHub CI ещё не зелёный для выбранного коммита.")


def runtime_files(archive):
    """Whitelisted game files; nested lib/assets stay portable, data stays intact."""
    root_ext = {".py", ".bat", ".html", ".js", ".css", ".ps1"}
    asset_ext = root_ext | {".png", ".jpg", ".jpeg", ".webp", ".gif", ".json", ".svg", ".woff2", ".wasm"}
    files = {}
    for member in archive.namelist():
        if member.endswith("/"):
            continue
        parts = Path(member.replace("\\", "/")).parts
        if len(parts) < 2 or any(p in ("", ".", "..") for p in parts):
            continue
        relative = Path(*parts[1:])
        if relative.parts[0] in ("lib", "assets") and len(relative.parts) >= 2:
            allowed = relative.suffix.lower() in asset_ext
        else:
            allowed = len(relative.parts) == 1 and (
                relative.name == "README.md" or relative.suffix.lower() in root_ext)
        if allowed and not any(part.startswith(".") for part in relative.parts):
            files[relative.as_posix()] = member
    if any(name not in files for name in FILES):
        raise ValueError("Incomplete update archive")
    return files


def rollback():
    manifest = BASE / ".aetherra_backup" / "manifest.json"
    if not manifest.exists():
        raise RuntimeError("Резервная копия не найдена")
    data = json.loads(manifest.read_text(encoding="utf-8"))
    for name in data["files"]:
        saved = BASE / ".aetherra_backup" / name
        current = BASE / name
        current.parent.mkdir(parents=True, exist_ok=True)
        if name in data["existing"]:
            shutil.copy2(saved, current)
        elif current.exists():
            current.unlink()
    old_sha = data.get("installed")
    version_file = BASE / ".aetherra_version"
    if old_sha:
        version_file.write_text(old_sha, encoding="ascii")
    elif version_file.exists():
        version_file.unlink()


def install():
    if (BASE / ".git").exists():
        raise RuntimeError("Обновление рабочей Git-копии запрещено: используйте git pull.")
    sha, _ = latest_commit()
    if sha == local_sha():
        return "Already up to date"
    verify_ci(sha)
    archive_url = f"https://github.com/{REPO}/archive/{sha}.zip"
    data = request_bytes(archive_url)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        members = runtime_files(z)
        with tempfile.TemporaryDirectory(prefix="aetherra-update-", dir=BASE) as tmp:
            temp = Path(tmp)
            for filename, member in members.items():
                payload = z.read(member)
                if len(payload) > 5 * 1024 * 1024:
                    raise ValueError("File too large: " + filename)
                (temp / filename).parent.mkdir(parents=True, exist_ok=True)
                (temp / filename).write_bytes(payload)
            for file in temp.rglob("*.py"):
                compile(file.read_bytes(), file.name, "exec")
            html = (temp / "index.html").read_text(encoding="utf-8")
            if "<canvas" not in html or "</html>" not in html:
                raise ValueError("Invalid game page")
            backup = BASE / ".aetherra_backup"
            backup.mkdir(exist_ok=True)
            existing = []
            previous_sha = local_sha()
            for name in members:
                if (BASE / name).exists():
                    (backup / name).parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(BASE / name, backup / name)
                    existing.append(name)
            (backup / "manifest.json").write_text(
                json.dumps({"files": list(members), "existing": existing,
                            "installed": previous_sha}), encoding="utf-8")
            try:
                for name in members:
                    (BASE / name).parent.mkdir(parents=True, exist_ok=True)
                    os.replace(temp / name, BASE / name)
                (BASE / ".aetherra_version").write_text(sha, encoding="ascii")
            except Exception:
                rollback()
                raise
    return "Installed: " + sha[:12]


def start_server_and_verify():
    """Use interpreter directly; don't re-enter a possibly rewritten BAT script."""
    kwargs = {"cwd": str(BASE)}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    else:
        kwargs["start_new_session"] = True
    with (BASE / "AETHERRA_SERVER.log").open("a", encoding="utf-8") as server_log:
        child = subprocess.Popen([sys.executable, "-u", str(BASE / "server.py")],
                                 stdout=server_log, stderr=subprocess.STDOUT, **kwargs)
    for _ in range(30):
        if child.poll() is not None:
            raise RuntimeError("Новый сервер завершился с ошибкой")
        try:
            with health_urlopen("http://127.0.0.1:8765/health", timeout=1) as reply:
                if json.load(reply).get("app") == "AETHERRA":
                    return
        except (OSError, ValueError, TimeoutError):
            time.sleep(.5)
    child.terminate()
    raise RuntimeError("Новый сервер не прошёл проверку /health")


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "install"
    try:
        if mode == "install-restart":
            time.sleep(2)
            updated = False
            try:
                message = install()
                updated = message.startswith("Installed:")
                print(message, flush=True)
                start_server_and_verify()
                print("New server is healthy", flush=True)
            except Exception as exc:
                print("Update or startup failed:", exc, file=sys.stderr, flush=True)
                if updated:
                    try:
                        rollback()
                        print("Rollback complete", flush=True)
                    except Exception as restore_error:
                        print("Rollback FAILED:", restore_error, file=sys.stderr, flush=True)
                try:
                    start_server_and_verify()
                except Exception as restart_error:
                    print("Recovery restart FAILED:", restart_error, file=sys.stderr, flush=True)
                return 1
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
