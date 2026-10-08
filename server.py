"""AETHERRA local browser server and localhost-only update API."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer, Thread
from urllib.parse import urlparse
import json
import subprocess
import sys
import webbrowser

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def _json(self, status, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/health":
            self._json(200, {"status": "ok", "app": "AETHERRA"})
            return
        if route == "/api/ai/status":
            from cloudru import status
            self._json(200, status())
            return
        if route == "/api/update/check":
            try:
                from update import check
                self._json(200, check())
            except Exception as exc:
                self._json(503, {"error": str(exc)})
            return
        super().do_GET()

    def do_POST(self):
        route = urlparse(self.path).path
        if route not in ("/api/update/install", "/api/ai/connect", "/api/ai/disconnect", "/api/ai/test", "/api/ai/advise"):
            self._json(404, {"error": "Not found"})
            return
        # Only requests initiated by our own local web page are accepted.
        origin = self.headers.get("Origin")
        if origin != f"http://{HOST}:{PORT}":
            self._json(403, {"error": "Invalid origin"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0 or length > 8192:
                self._json(413, {"error": "Request too large"})
                return
            body = self.rfile.read(length)
            if route.startswith("/api/ai/"):
                from cloudru import connect, disconnect, test_connection, ask_world_advice
                try:
                    if route == "/api/ai/connect":
                        result = connect(json.loads(body).get("key"))
                    elif route == "/api/ai/disconnect":
                        result = disconnect()
                    elif route == "/api/ai/advise":
                        result = ask_world_advice(json.loads(body).get("question"))
                    else:
                        result = test_connection()
                    self._json(200, result)
                except (ValueError, TypeError, json.JSONDecodeError) as exc:
                    self._json(400, {"error": str(exc)})
                return
            kwargs = {"cwd": str(ROOT), "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
            if sys.platform == "win32":
                kwargs["creationflags"] = subprocess.CREATE_NEW_CONSOLE
            subprocess.Popen([sys.executable, str(ROOT / "update.py"), "install-restart"], **kwargs)
            self._json(202, {"status": "updating"})
            Thread(target=self.server.shutdown, daemon=True).start()
        except Exception as exc:
            self._json(500, {"error": str(exc)})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

def main():
    try:
        server = ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=str(ROOT)))
    except OSError as exc:
        print(f"Unable to start AETHERRA on {HOST}:{PORT}: {exc}")
        return 1
    url = f"http://{HOST}:{PORT}/"
    print(f"AETHERRA: {url}", flush=True)
    Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nAETHERRA stopped")
    finally:
        server.server_close()
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
