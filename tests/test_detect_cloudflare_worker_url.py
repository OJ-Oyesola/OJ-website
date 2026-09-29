import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "tools" / "detect_cloudflare_worker_url.py"


class DetectCloudflareWorkerUrlTests(unittest.TestCase):
    def detect(self, payload: str) -> str:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--worker-name", "oj-website-api"],
            input=payload,
            text=True,
            capture_output=True,
            check=True,
        )
        return result.stdout.strip()

    def test_extracts_direct_url_from_text(self):
        self.assertEqual(
            self.detect("Deployed to https://oj-website-api.demoacct.workers.dev successfully"),
            "https://oj-website-api.demoacct.workers.dev",
        )

    def test_builds_url_from_subdomain_field(self):
        self.assertEqual(
            self.detect('{"accounts":[{"name":"Demo","subdomain":"demoacct"}]}'),
            "https://oj-website-api.demoacct.workers.dev",
        )

    def test_extracts_direct_url_from_json_value(self):
        self.assertEqual(
            self.detect('{"deployment":{"url":"https://oj-website-api.demoacct.workers.dev"}}'),
            "https://oj-website-api.demoacct.workers.dev",
        )

    def test_builds_url_from_account_subdomain_response(self):
        self.assertEqual(
            self.detect('{"result":{"subdomain":"demoacct"},"success":true}'),
            "https://oj-website-api.demoacct.workers.dev",
        )


if __name__ == "__main__":
    unittest.main()
