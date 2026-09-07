#!/usr/bin/env python3
"""Check local links, HTML structure, CSS assets and client-gallery files, offline."""
import datetime as dt
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path, self.ids, self.links, self.stack, self.errors = path, set(), [], [], []
        self.noindex = False
        self.feed(path.read_text(encoding="utf-8"))
        self.close()
        if self.stack:
            self.errors.append(f"Unclosed tags: {self.stack}")

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if len(attrs) != len(attributes):
            self.errors.append(f"Duplicate attributes on <{tag}>")
        if tag not in VOID:
            self.stack.append(tag)
        if "id" in attrs:
            if attrs["id"] in self.ids:
                self.errors.append(f"Duplicate id: {attrs['id']}")
            self.ids.add(attrs["id"])
        if tag == "meta" and attrs.get("name") == "robots":
            self.noindex = "noindex" in attrs.get("content", "")
        if tag == "img" and "alt" not in attrs:
            self.errors.append("Image is missing alt text")
        for key in ("href", "src"):
            if key in attrs:
                if not attrs[key]:
                    self.errors.append(f"Empty {key} on <{tag}>")
                else:
                    self.links.append(attrs[key])

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.errors.append(f"Unexpected closing tag: </{tag}>")
        else:
            self.stack.pop()


def local_target(source, value, root=ROOT):
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return None, ""
    path = unquote(url.path)
    target = (root / path.lstrip("/") if path.startswith("/") else source.parent / path).resolve() if path else source
    return target, unquote(url.fragment)


def check_site(root=ROOT):
    errors = []
    pages = {path: Page(path) for path in root.glob("*.html")}

    def check_link(source, value):
        target, fragment = local_target(source, value, root)
        if target is None:
            return
        if not target.is_relative_to(root) or not target.exists():
            errors.append(f"{source.relative_to(root)}: missing/unsafe local asset {value}")
        elif fragment and target in pages and fragment not in pages[target].ids:
            errors.append(f"{source.name}: missing anchor {value}")

    for path, page in pages.items():
        errors.extend(f"{path.name}: {error}" for error in page.errors)
        for link in page.links:
            check_link(path, link)
    for path in (root / "assets/css").glob("*.css"):
        for match in re.finditer(r'''url\(\s*(?:"([^"]*)"|'([^']*)'|([^\)\s]+))\s*\)''', path.read_text(encoding="utf-8")):
            check_link(path, next(value for value in match.groups() if value is not None))
    manifest = root / "site.webmanifest"
    for icon in json.loads(manifest.read_text(encoding="utf-8"))["icons"]:
        check_link(manifest, icon["src"])
    for path in (root / "galleries").glob("*/data.json"):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("expires"):
            try:
                if dt.date.fromisoformat(data["expires"]).isoformat() != data["expires"]:
                    raise ValueError("Invalid format")
            except ValueError:
                errors.append(f"{path.relative_to(root)}: invalid expiry")
        for photo in data.get("photos", []):
            for size in ("full", "grid", "thumb"):
                check_link(path, photo[size])
            if photo.get("w", 0) <= 0 or photo.get("h", 0) <= 0:
                errors.append(f"{path.relative_to(root)}: invalid photo dimensions")
    for loc in ET.parse(root / "sitemap.xml").iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc"):
        page = pages.get(root / (Path(urlsplit(loc.text).path).name or "index.html"))
        if page and page.noindex:
            errors.append(f"sitemap.xml includes noindex page {page.path.name}")
    return errors, len(pages)


if __name__ == "__main__":
    problems, count = check_site()
    if problems:
        print("\n".join(problems), file=sys.stderr)
        sys.exit(1)
    print(f"Checked {count} HTML pages, CSS assets, sitemap and client-gallery files.")
