"""AETHERRA local browser server; no third-party packages."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Timer
from urllib.parse import urlparse
import webbrowser

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if urlparse(self.path).path == "/health":
            payload = b'{"status":"ok","app":"AETHERRA"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

def main():
    try:
        server = ThreadingHTTPServer(
            (HOST, PORT), partial(Handler, directory=str(ROOT))
        )
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
