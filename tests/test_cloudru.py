import unittest
from unittest.mock import patch
import cloudru

class CloudRuSettingsTests(unittest.TestCase):
    def tearDown(self):
        cloudru.disconnect()

    def test_key_never_returned_from_status(self):
        cloudru.connect("secret-example-token")
        info=cloudru.status()
        self.assertTrue(info["connected"])
        self.assertNotIn("secret-example-token",repr(info))

    def test_connection_checks_expected_model(self):
        import io
        payload=b'{"data":[{"id":"deepseek-ai/DeepSeek-V4-Flash"}]}'
        class Response:
            def __enter__(self): return io.BytesIO(payload)
            def __exit__(self,*args): return False
        cloudru.connect("secret-example-token")
        with patch.object(cloudru,"urlopen",return_value=Response()):
            result=cloudru.test_connection()
        self.assertTrue(result["authenticated"])
        self.assertTrue(result["model_available"])

    def test_disconnect_removes_key(self):
        cloudru.connect("secret-example-token")
        cloudru.disconnect()
        self.assertFalse(cloudru.status()["connected"])
        with self.assertRaises(ValueError):
            cloudru.test_connection()

if __name__=="__main__":
    unittest.main()
