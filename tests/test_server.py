import http.client
import json
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest import TestCase

from server import Handler


class ServerSmokeTests(TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1]
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(root)))
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, path):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        try:
            connection.request("GET", path)
            response = connection.getresponse()
            return response.status, response.read()
        finally:
            connection.close()

    def test_health(self):
        status, data = self.request("/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(data)["status"], "ok")

    def test_home_page(self):
        status, data = self.request("/")
        self.assertEqual(status, 200)
        self.assertIn(b"AETHERRA", data)
        self.assertIn(b"<canvas", data)

    def test_missing_file(self):
        status, _ = self.request("/not-a-real-file.txt")
        self.assertEqual(status, 404)
