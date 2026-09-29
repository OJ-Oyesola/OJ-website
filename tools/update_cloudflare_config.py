#!/usr/bin/env python3
"""Generate wrangler.toml and a tracked Cloudflare resource manifest."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WRANGLER = ROOT / "wrangler.toml"
MANIFEST = ROOT / "cloudflare" / "resources.json"

WORKER_NAME = os.environ.get("CF_WORKER_NAME", "oj-website-api")
MEDIA_BUCKET = os.environ.get("CF_R2_MEDIA_BUCKET", "")
MEDIA_PREVIEW_BUCKET = os.environ.get("CF_R2_MEDIA_PREVIEW_BUCKET", "")
DB_NAME = os.environ.get("CF_D1_DATABASE_NAME", "")
DB_ID = os.environ.get("CF_D1_DATABASE_ID", "")
WORKER_URL = os.environ.get("CF_WORKER_URL", "")

try:
    existing_manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
except FileNotFoundError:
    existing_manifest = {}
except json.JSONDecodeError:
    existing_manifest = {}

if not WORKER_URL:
    WORKER_URL = (
        existing_manifest.get("worker", {}).get("url")
        or existing_manifest.get("worker", {}).get("workers_dev_url")
        or ""
    )


def quoted(value: str) -> str:
    return json.dumps(value)


lines = [
    f'name = {quoted(WORKER_NAME)}',
    'main = "workers/api/index.js"',
    'compatibility_date = "2026-09-29"',
    'workers_dev = true',
    'minify = false',
    '',
    '[observability.logs]',
    'enabled = true',
    '',
    '[vars]',
    'API_VERSION = "2026-09-29"',
    ''
]

if MEDIA_BUCKET and MEDIA_PREVIEW_BUCKET:
    lines.extend([
        '[[r2_buckets]]',
        'binding = "MEDIA"',
        f'bucket_name = {quoted(MEDIA_BUCKET)}',
        f'preview_bucket_name = {quoted(MEDIA_PREVIEW_BUCKET)}',
        ''
    ])
else:
    lines.extend([
        '# [[r2_buckets]]',
        '# binding = "MEDIA"',
        '# bucket_name = "oj-website-media"',
        '# preview_bucket_name = "oj-website-media-preview"',
        ''
    ])

if DB_NAME and DB_ID:
    lines.extend([
        '[[d1_databases]]',
        'binding = "DB"',
        f'database_name = {quoted(DB_NAME)}',
        f'database_id = {quoted(DB_ID)}',
        'migrations_dir = "db/migrations"',
        ''
    ])
else:
    lines.extend([
        '# [[d1_databases]]',
        '# binding = "DB"',
        '# database_name = "oj-website"',
        '# database_id = "replace-with-your-d1-database-id"',
        '# migrations_dir = "db/migrations"',
        ''
    ])

WRANGLER.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")

MANIFEST.parent.mkdir(parents=True, exist_ok=True)
MANIFEST.write_text(json.dumps({
    'worker': {
        'name': WORKER_NAME,
        'url': WORKER_URL or None
    },
    'r2': {
        'binding': 'MEDIA',
        'bucket': MEDIA_BUCKET or None,
        'preview_bucket': MEDIA_PREVIEW_BUCKET or None
    },
    'd1': {
        'binding': 'DB',
        'database_name': DB_NAME or None,
        'database_id': DB_ID or None,
        'migrations_dir': 'db/migrations'
    }
}, indent=2) + "\n", encoding="utf-8")

print(f'Updated {WRANGLER.relative_to(ROOT)} and {MANIFEST.relative_to(ROOT)}')
