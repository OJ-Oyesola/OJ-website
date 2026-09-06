#!/usr/bin/env python3
"""
OJ_Oyesola — client gallery builder
====================================
Turns a folder of photos into a private, access-coded client gallery.

Usage
-----
    python3 tools/new_gallery.py \
        --email    client@example.com \
        --code     OJ-7KQ2-9XMP \
        --title    "The Adewales" \
        --subtitle "Portrait Session" \
        --date     "December 2025" \
        --dir      /path/to/photos \
        [--expires 2026-12-15]          # optional; default = 12 months from today
        [--external-url https://...]    # optional; gallery hosted elsewhere (Pixieset etc.)

What it does
------------
1. Copies + resizes every JPG/PNG into three sizes:
       full/   (long edge 2000px — what clients download)
       grid/   (long edge 1000px — what loads in the gallery grid)
       thumbs/ (long edge 420px — lightweight previews)
2. Writes  galleries/<sha256(email|CODE|salt)>/data.json
3. Prints the exact email + code to send to the client.

The client then signs in at  client.html  with that email + code.

Requirements:  pip install Pillow     (see tools/requirements.txt)

NOTE — the salt below must stay in sync with `salt` in assets/js/config.js.
"""
import argparse
import datetime as dt
import hashlib
import json
import pathlib
import re
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow  (see tools/requirements.txt)")

# -- Keep in sync with `salt` in assets/js/config.js -------------------------
SALT = "f90fab92741ea744b18d7471c6ad555e"
# -----------------------------------------------------------------------------

ROOT = pathlib.Path(__file__).resolve().parent.parent
GALLERIES = ROOT / "galleries"
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def gallery_hash(email: str, code: str) -> str:
    payload = f"{email.strip().lower()}|{code.strip().upper()}|{SALT}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def slugify(text: str) -> str:
    return re.sub(r"[^\w\-]+", "-", (text or "gallery").lower()).strip("-")[:40] or "gallery"


def save_resized(img: Image.Image, out_path: pathlib.Path, long_edge: int, quality: int = 86) -> tuple[int, int]:
    img = img.copy()
    img = img.convert("RGB")
    w, h = img.size
    scale = long_edge / max(w, h)
    if scale < 1:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    img.save(out_path, "JPEG", quality=quality, optimize=True, progressive=True)
    return img.size


def build(args: argparse.Namespace) -> None:
    src_dir = pathlib.Path(args.dir).expanduser().resolve()
    if not src_dir.is_dir():
        sys.exit(f"Photo folder not found: {src_dir}")

    files = sorted(
        p for p in src_dir.iterdir()
        if p.is_file() and p.suffix.lower() in EXTENSIONS and not p.name.startswith(".")
    )
    if not files:
        sys.exit(f"No JPG/PNG/WebP images found in {src_dir}")
    if not args.email or not args.code:
        sys.exit("--email and --code are required")

    h = gallery_hash(args.email, args.code)
    dest = GALLERIES / h
    if dest.exists() and not args.force:
        sys.exit(
            f"A gallery already exists for this email+code at {dest}.\n"
            f"Use --force to overwrite it."
        )

    for sub in ("full", "grid", "thumbs"):
        (dest / sub).mkdir(parents=True, exist_ok=True)

    photos = []
    for i, src in enumerate(files, start=1):
        name = f"{i:03d}"
        with Image.open(src) as img:
            img = ImageOps.exif_transpose(img)  # respect EXIF rotation
            w, hgt = save_resized(img, dest / "full" / f"{name}.jpg", 2000, quality=90)
            save_resized(img, dest / "grid" / f"{name}.jpg", 1000)
            save_resized(img, dest / "thumbs" / f"{name}.jpg", 420, quality=80)
        photos.append({
            "full": f"full/{name}.jpg",
            "grid": f"grid/{name}.jpg",
            "thumb": f"thumbs/{name}.jpg",
            "w": w,
            "h": hgt,
        })
        print(f"  processed {src.name}  ->  {name}.jpg ({w}x{hgt})")

    data = {
        "title": args.title or "Your Gallery",
        "subtitle": args.subtitle or "",
        "date": args.date or "",
        "expires": args.expires or (dt.date.today() + dt.timedelta(days=365)).isoformat(),
        "photos": photos,
    }
    if args.external_url:
        data["externalUrl"] = args.external_url

    (dest / "data.json").write_text(json.dumps(data, indent=2), encoding="utf-8")

    print("\n✓ Gallery created")
    print(f"  Location : galleries/{h}/  ({len(photos)} photos)")
    print(f"  Login at : client.html")
    print(f"  Email    : {args.email.strip().lower()}")
    print(f"  Code     : {args.code.strip().upper()}")
    if not args.external_url:
        print(f"  Expires  : {data['expires']}")
    print("\nSend the email + code above to your client. That's all they need.")


def main() -> None:
    p = argparse.ArgumentParser(description="Build a private OJ_Oyesola client gallery.")
    p.add_argument("--email", required=True, help="client's email (what they'll type to log in)")
    p.add_argument("--code", required=True, help="access code, e.g. OJ-7KQ2-9XMP")
    p.add_argument("--title", default="Your Gallery", help="gallery title, e.g. 'The Adewales'")
    p.add_argument("--subtitle", default="", help="e.g. 'Portrait Session'")
    p.add_argument("--date", default="", help="display date, e.g. 'December 2025'")
    p.add_argument("--dir", required=True, help="folder containing the client's photos")
    p.add_argument("--expires", default="", help="YYYY-MM-DD; defaults to 12 months out")
    p.add_argument("--external-url", default="", help="host gallery elsewhere (Pixieset, Pic-Time…)")
    p.add_argument("--force", action="store_true", help="overwrite an existing gallery for this email+code")
    build(p.parse_args())


if __name__ == "__main__":
    main()
