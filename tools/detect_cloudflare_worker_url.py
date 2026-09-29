#!/usr/bin/env python3
"""Best-effort detector for a deployed workers.dev URL from Wrangler output."""
from __future__ import annotations

import argparse
import json
import re
import sys
from typing import Any

DIRECT_URL_RE = re.compile(r"https?://[A-Za-z0-9.-]+\.workers\.dev(?:\b|/[^\s\"']*)", re.IGNORECASE)
HOST_RE = re.compile(r"^[A-Za-z0-9.-]+\.workers\.dev$", re.IGNORECASE)
LABEL_RE = re.compile(r"^[A-Za-z0-9-]+$", re.IGNORECASE)


def normalize_direct_url(value: str) -> str:
    match = DIRECT_URL_RE.search(value.strip())
    return match.group(0).rstrip(".,;)]}") if match else ""


def candidate_from_value(worker_name: str, key: str, value: str) -> list[str]:
    value = value.strip()
    if not value:
        return []
    candidates: list[str] = []
    direct = normalize_direct_url(value)
    if direct:
        candidates.append(direct)
    elif HOST_RE.fullmatch(value):
        candidates.append(f"https://{value}")
    if re.search(r"subdomain|workers.?dev", key, re.IGNORECASE) and LABEL_RE.fullmatch(value):
        candidates.append(f"https://{worker_name}.{value}.workers.dev")
    return candidates


def iter_candidates(worker_name: str, key: str, value: Any) -> list[str]:
    if isinstance(value, str):
        return candidate_from_value(worker_name, key, value)
    if isinstance(value, list):
        found: list[str] = []
        for item in value:
            found.extend(iter_candidates(worker_name, key, item))
        return found
    if isinstance(value, dict):
        found: list[str] = []
        for child_key, child_value in value.items():
            found.extend(iter_candidates(worker_name, child_key, child_value))
        return found
    return []


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker-name", required=True)
    args = parser.parse_args()

    raw = sys.stdin.read().strip()
    if not raw:
        return 0

    direct = normalize_direct_url(raw)
    if direct:
        print(direct)
        return 0

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return 0

    seen: set[str] = set()
    ordered: list[str] = []
    for candidate in iter_candidates(args.worker_name, "", data):
        if candidate not in seen:
            seen.add(candidate)
            ordered.append(candidate)

    if ordered:
        print(ordered[0])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
