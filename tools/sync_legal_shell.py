#!/usr/bin/env python3
"""Sync shared legal-page header/footer markup into the static HTML pages."""
from __future__ import annotations

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = ROOT / "tools" / "templates"
TARGETS = [ROOT / name for name in ("contract.html", "privacy.html", "terms.html")]
BLOCKS = {
    "HEADER": TEMPLATE_DIR / "legal_header.html",
    "FOOTER": TEMPLATE_DIR / "legal_footer.html",
}


def marker(name: str, kind: str) -> str:
    return f"  <!-- LEGAL-SHELL:{name}:{kind} -->"


def template_text(path: Path) -> str:
    return path.read_text(encoding="utf-8").rstrip() + "\n"


def replace_block(text: str, name: str, replacement: str) -> str:
    start = marker(name, "start")
    end = marker(name, "end")
    before, found, remainder = text.partition(start)
    if not found:
        raise ValueError(f"Missing marker in page: {start}")
    _, found, after = remainder.partition(end)
    if not found:
        raise ValueError(f"Missing marker in page: {end}")
    return before + start + "\n" + replacement + end + after


def sync_text(text: str, blocks: dict[str, str]) -> str:
    for name, replacement in blocks.items():
        text = replace_block(text, name, replacement)
    return text


def page_blocks() -> dict[str, str]:
    return {name: template_text(path) for name, path in BLOCKS.items()}


def sync_pages(paths: list[Path], check: bool = False) -> list[Path]:
    replacements = page_blocks()
    stale = []
    for path in paths:
        current = path.read_text(encoding="utf-8")
        updated = sync_text(current, replacements)
        if updated != current:
            if check:
                stale.append(path)
            else:
                path.write_text(updated, encoding="utf-8")
    return stale


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if any legal page shell is out of sync")
    args = parser.parse_args()
    stale = sync_pages(TARGETS, check=args.check)
    if stale:
        names = ", ".join(path.name for path in stale)
        parser.exit(1, f"Legal page shell is stale for: {names}. Run: python3 tools/sync_legal_shell.py\n")
    action = "Checked" if args.check else "Synced"
    print(f"{action} legal page shell across {len(TARGETS)} pages.")


if __name__ == "__main__":
    main()
