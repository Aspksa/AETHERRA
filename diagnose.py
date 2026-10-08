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


def probe(command):
    try:
        result = subprocess.run(command, capture_output=True, text=True,
                                timeout=6, errors="replace", check=False)
        return {"available": result.returncode == 0,
                "return_code": result.returncode,
                "version": result.stdout.strip().splitlines()[0][:100]
                           if result.returncode == 0 and result.stdout.strip() else ""}
    except (OSError, subprocess.TimeoutExpired) as err:
        return {"available": False, "error": type(err).__name__}


def diagnose(root=ROOT):
    root = Path(root)
    checks = {"time_utc": datetime.now(timezone.utc).isoformat(),
              "platform": sys.platform,
              "current_python": sys.version.split()[0],
              "files": {file: (root / file).is_file() for file in EXPECTED},
              "python": {}, "server_port": {}}
    for name in ("py", "python", "python3"):
        exe = shutil.which(name)
        checks["python"][name] = probe([exe, "-3", "--version"] if name == "py"
                                        else [exe, "--version"]) if exe else {"available": False, "error": "not_on_path"}
    for name, exe in (("portable", root / "python" / "python.exe"),
                      ("venv", root / ".venv" / "Scripts" / "python.exe")):
        checks["python"][name] = probe([str(exe), "--version"]) if exe.is_file() else {"available": False, "error": "missing"}
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
