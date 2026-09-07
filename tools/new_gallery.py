#!/usr/bin/env python3
"""Build an unlisted static client gallery (not server-authenticated storage).

python3 tools/new_gallery.py --email client@example.com --code OJ-7KQ2-9XMP \
    --title "The Adewales" --dir /path/to/photos

Alternatively, use --external-url https://example.com/gallery instead of --dir.
Local photos require Pillow: pip install -r tools/requirements.txt
The gallery salt is read directly from assets/js/config.js.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
GALLERIES = ROOT / "galleries"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def gallery_hash(email: str, code: str) -> str:
    config = (ROOT / "assets/js/config.js").read_text(encoding="utf-8")
    match = re.search(r'^\s*salt\s*:\s*("(?:[^"\\]|\\.)*")\s*,?\s*$', config, re.MULTILINE)
    if not match or not (salt := json.loads(match.group(1))):
        raise ValueError('Set a non-empty, double-quoted salt in assets/js/config.js.')
    payload = f"{email.strip().lower()}|{code.strip().upper()}|{salt}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def expiry_date(value: str) -> str:
    try:
        parsed = dt.date.fromisoformat(value)
    except ValueError as err:
        raise argparse.ArgumentTypeError("Expiry must be a valid YYYY-MM-DD date.") from err
    if parsed.isoformat() != value:
        raise argparse.ArgumentTypeError("Expiry must use YYYY-MM-DD.")
    return value


def external_url(value: str) -> str:
    try:
        url = urlsplit(value)
        valid = url.scheme in {"https", "http"} and url.hostname and not url.username and not url.password
    except ValueError:
        valid = False
    if not valid:
        raise argparse.ArgumentTypeError("External gallery URL must be an absolute HTTP(S) URL without credentials.")
    return value


def default_expiry() -> str:
    today = dt.date.today()
    try:
        return today.replace(year=today.year + 1).isoformat()
    except ValueError:  # February 29 has no counterpart next year.
        return today.replace(year=today.year + 1, day=28).isoformat()


def save_resized(image, path: Path, long_edge: int, quality: int = 86):
    from PIL import Image
    resized = image.copy()
    resized.thumbnail((long_edge, long_edge), Image.Resampling.LANCZOS)
    resized.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    return resized.size


def build(args: argparse.Namespace) -> Path:
    if not args.email.strip() or "@" not in args.email or not args.code.strip():
        raise ValueError("A client email and a non-empty access code are required.")
    if bool(args.dir) == bool(args.external_url):
        raise ValueError("Provide either --dir or --external-url, not both.")
    if args.expires:
        expiry_date(args.expires)
    if args.external_url:
        external_url(args.external_url)

    files = []
    if args.dir:
        from PIL import Image, ImageOps
        source = Path(args.dir).expanduser().resolve()
        if not source.is_dir():
            raise ValueError(f"Photo folder not found: {source}")
        files = sorted(p for p in source.iterdir()
                       if p.is_file() and p.suffix.lower() in EXTENSIONS and not p.name.startswith("."))
        if not files:
            raise ValueError(f"No JPG/PNG/WebP images found in {source}")

    gallery_id = gallery_hash(args.email, args.code)
    dest = GALLERIES / gallery_id
    if dest.exists() and not args.force:
        raise ValueError(f"A gallery already exists at {dest}. Use --force to replace it.")

    GALLERIES.mkdir(parents=True, exist_ok=True)
    # Finish processing first. A corrupt input must never damage an existing delivery.
    with tempfile.TemporaryDirectory(prefix=".gallery-", dir=GALLERIES) as temp:
        staged = Path(temp) / "new"
        staged.mkdir()
        if files:
            for sub in ("full", "grid", "thumbs"):
                (staged / sub).mkdir()
        photos = []
        for i, src in enumerate(files, start=1):
            name = f"{i:03d}.jpg"
            with Image.open(src) as original:
                image = ImageOps.exif_transpose(original).convert("RGB")
                width, height = save_resized(image, staged / "full" / name, 2000, quality=90)
                save_resized(image, staged / "grid" / name, 1000)
                save_resized(image, staged / "thumbs" / name, 420, quality=80)
            photos.append({"full": f"full/{name}", "grid": f"grid/{name}", "thumb": f"thumbs/{name}",
                           "w": width, "h": height})
            print(f"  processed {src.name} -> {name} ({width}x{height})")

        data = {"title": args.title, "subtitle": args.subtitle, "date": args.date,
                "expires": args.expires or default_expiry(), "photos": photos}
        if args.external_url:
            data["externalUrl"] = args.external_url
        (staged / "data.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

        backup = Path(temp) / "previous"
        if dest.exists():
            dest.rename(backup)
        try:
            staged.rename(dest)
        except OSError:
            if backup.exists():
                backup.rename(dest)
            raise
        # TemporaryDirectory removes the previous version, including stale photos.

    print(f"\nGallery created: galleries/{gallery_id}/ ({len(photos)} photos)")
    print(f"Login at: client.html\nEmail: {args.email.strip().lower()}\nCode: {args.code.strip().upper()}")
    print(f"Expires: {data['expires']} (end of day, UTC)")
    return dest


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True, help="client's email")
    parser.add_argument("--code", required=True, help="access code, e.g. OJ-7KQ2-9XMP")
    parser.add_argument("--title", default="Your Gallery")
    parser.add_argument("--subtitle", default="", help="e.g. Portrait Session")
    parser.add_argument("--date", default="", help="display date, e.g. December 2026")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--dir", help="folder containing the client's photos")
    source.add_argument("--external-url", type=external_url, help="gallery hosted elsewhere")
    parser.add_argument("--expires", type=expiry_date, help="YYYY-MM-DD; defaults to 12 months out")
    parser.add_argument("--force", action="store_true", help="replace an existing gallery, including its old photos")
    return parser.parse_args(argv)


def main():
    try:
        build(parse_args())
    except ImportError as err:
        raise SystemExit("Local photos require Pillow: pip install -r tools/requirements.txt") from err
    except (OSError, ValueError, argparse.ArgumentTypeError) as err:
        raise SystemExit(str(err)) from err


if __name__ == "__main__":
    main()
