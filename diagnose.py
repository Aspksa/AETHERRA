"""Collect safe Windows startup diagnostics for AETHERRA.

No installation, no modification of game data. Report excludes user
environment variables, usernames, and full absolute paths.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent
EXPECTED = ("AETHERRA.bat", "PLAY_OFFLINE.bat", "server.py", "index.html",
            "update.py", "UPDATE_AETHERRA.bat")


TOKEN = "AETHERRA_PYTHON_OK"
CODE = "import sys;print('%s', sys.version.split()[0])" % TOKEN


def probe(command):
    """Run real Python code: a broken alias can exit 0 on --version yet fail to start."""
    try:
        result = subprocess.run(command, capture_output=True, text=True,
                                timeout=6, errors="replace", check=False)
        lines = result.stdout.strip().splitlines()
        ok = result.returncode == 0 and bool(lines) and lines[0].startswith(TOKEN)
        report = {"available": ok, "return_code": result.returncode,
                  "version": lines[0][len(TOKEN):].strip()[:40] if ok else ""}
        if not ok and result.stderr.strip():
            # Keep the reason (e.g. 0x80070002), but never the user's profile path.
            report["error_text"] = mask(result.stderr.strip().splitlines()[0])[:200]
        return report
    except (OSError, subprocess.TimeoutExpired) as err:
        return {"available": False, "error": type(err).__name__}


def mask(text):
    home = os.path.expanduser("~")
    return text.replace(home, "~") if home and home != "~" else text


def diagnose(root=ROOT):
    root = Path(root)
    checks = {"time_utc": datetime.now(timezone.utc).isoformat(),
              "platform": sys.platform,
              "current_python": sys.version.split()[0],
              "files": {file: (root / file).is_file() for file in EXPECTED},
              "python": {}, "server_port": {}}
    for name in ("py", "python", "python3"):
        exe = shutil.which(name)
        checks["python"][name] = probe([exe, "-3", "-c", CODE] if name == "py"
                                        else [exe, "-c", CODE]) if exe else {"available": False, "error": "not_on_path"}
    for name, exe in (("portable", root / "python" / "python.exe"),
                      ("venv", root / ".venv" / "Scripts" / "python.exe")):
        checks["python"][name] = probe([str(exe), "-c", CODE]) if exe.is_file() else {"available": False, "error": "missing"}
    try:
        with socket.socket() as sock:
            sock.settimeout(1.5)
            checks["server_port"]["8765_listening"] = sock.connect_ex(("127.0.0.1", 8765)) == 0
    except OSError as err:
        checks["server_port"]["error"] = type(err).__name__
    checks["ready_offline"] = checks["files"]["index.html"]
    checks["ready_server"] = (checks["files"]["server.py"] and
                              any(p["available"] for p in checks["python"].values()))
    return checks


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(ROOT / "AETHERRA_DIAGNOSTICS.txt"))
    args = parser.parse_args()
    report = diagnose()
    destination = Path(args.output)
    destination.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Report saved:", destination.name)
    print("Offline launch:", "READY" if report["ready_offline"] else "MISSING FILE")
    print("Server prerequisites:", "READY" if report["ready_server"] else "NOT READY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
