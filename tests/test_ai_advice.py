import io
import json
import unittest
from unittest.mock import patch
import cloudru

class AdviceTests(unittest.TestCase):
    def tearDown(self):
        cloudru.disconnect()

    def test_no_key_no_api_request(self):
        cloudru.disconnect()
        with patch.object(cloudru,"urlopen") as call:
            with self.assertRaises(ValueError):
                cloudru.ask_world_advice("Помоги деревне")
        call.assert_not_called()

    def test_prompt_restricted(self):
        cloudru.connect("longtestsecret")
        with self.assertRaises(ValueError):
            cloudru.ask_world_advice("x" * 601)

    def test_model_and_token_cap(self):
        cloudru.connect("longtestsecret")
        class Response:
            def __enter__(self):
                return io.BytesIO(json.dumps({"choices":[{"message":{"content":"Постройте ферму"}}],"usage":{"total_tokens":57}}).encode())
            def __exit__(self,*args):
                return False
        def fake(request,timeout):
            body=json.loads(request.data)
            self.assertEqual(body["model"],cloudru.MODEL)
            self.assertEqual(body["max_completion_tokens"],240)
            self.assertEqual(timeout,30)
            return Response()
        with patch.object(cloudru,"urlopen",side_effect=fake):
            result=cloudru.ask_world_advice("Как выживать?")
        self.assertEqual(result["tokens"],57)
        self.assertIn("ферму",result["answer"])

if __name__=="__main__":
    unittest.main()
