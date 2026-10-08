import json
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import update

SHA="a"*40
ATOM=('<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">'
      '<entry><title>Fixed updater</title><link href="https://github.com/Aspksa/AETHERRA/commit/'+SHA+'"/></entry>'
      '</feed>').encode()

class WorldUpdateCheckTests(unittest.TestCase):
    def test_primary_api_returns_sha_and_notes(self):
        payload=json.dumps({"sha":SHA,"commit":{"message":"Release notes\nLong"}}).encode()
        with patch.object(update,"request_bytes",return_value=payload):
            with patch.object(update,"local_sha",return_value=SHA):
                result=update.check()
        self.assertFalse(result["update_available"])
        self.assertEqual(result["description"],"Release notes")

    def test_api_rate_limit_falls_back_to_atom(self):
        def request(url, maximum=update.MAX_ZIP):
            if url==update.API: raise HTTPError(url,403,"rate limited",{},None)
            return ATOM
        with patch.object(update,"request_bytes",side_effect=request):
            with patch.object(update,"local_sha",return_value=None):
                result=update.check()
        self.assertEqual(result["latest"],SHA)
        self.assertEqual(result["description"],"Fixed updater")
        self.assertTrue(result["update_available"])

    def test_both_network_paths_fail_with_readable_message(self):
        with patch.object(update,"request_bytes",side_effect=URLError("offline")):
            with self.assertRaisesRegex(RuntimeError,"GitHub"):
                update.check()

if __name__=="__main__": unittest.main()
