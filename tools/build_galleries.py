#!/usr/bin/env python3
"""
build_galleries.py — generate assets/js/galleries.js from the on-disk shoot folders.

Scans the top-level portfolio folders at the repo root and writes a static JS
manifest (OJ_GALLERIES) that lists every real photo per collection, so the
homepage portfolio can be driven purely by the folders (one gallery per folder)
with no hard-coded tiles. Also emits OJ_HEROES (the real hero-image pool).
Dimensions are read with Pillow (pip install -r tools/requirements.txt).

Usage:
    python3 tools/build_galleries.py          # run from the repo root

Metadata (title / category / blurb) is declared below; file lists are read
straight from each folder so a new photo dropped in a folder appears on rebuild.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import quote

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# display order + editorial metadata for every gallery (one per shoot folder)
GALLERIES = [
    # id, folder, title, cat, blurb
    ("headshots-portfolio", "Headshots Portfolio", "Headshots Portfolio", "portraits",
     "Boardroom-ready and beyond — a wide run of professional portraits for teams, founders and everyone whose first impression matters."),
    ("headshots", "Headshots", "Headshots", "portraits",
     "Close-up, confident headshots in soft, sculpted light — made for profiles that need to say \u2018trust me\u2019 before you speak."),
    ("inductees", "Inductees", "Inductees", "portraits",
     "Dressed like champions — the 2am crowd caught mid-celebration at induction, ceremonial gown and all."),
    ("grad-induction", "Grad & Induction", "Grad & Induction", "portraits",
     "Graduation and induction milestones — hood, gown, handshake and the family pride around it."),
    ("style-all", "Style & All", "Style & All", "portraits",
     "Personal-branding portraits — style-first sessions for creators, professionals and people with a look."),
    ("birthdays", "Birthdays", "Birthdays", "portraits",
     "Cake-frost smiles and surprise-seconds — milestones celebrated exactly as they felt."),
    ("couples", "Couples", "Couples", "weddings",
     "Engagement and anniversary sessions for couples who laugh with their whole faces."),
    ("ayo-ola", "Ayo & Ola", "Ayo & Ola", "weddings",
     "Two families, one blessed afternoon — the vows, the fabric and the joy of Ayo & Ola."),
    ("crimson", "Crimson", "Crimson", "editorial",
     "A fine-art study in red — silk, skin and sculpted light."),
    ("arambara", "Arambara", "Arambara", "editorial",
     "A movement study in motion and stillness — fashion-forward frames for the bold."),
    ("light-dark", "Light & Dark", "Light & Dark", "editorial",
     "Chiaroscuro portraits where shadow does half the talking."),
    ("suit-boss", "Suit Boss", "Suit Boss", "editorial",
     "Tailoring as armour — a menswear editorial cut close to the bone."),
    ("brown-sugar", "Brown Sugar", "Brown Sugar", "editorial",
     "Warm tones, warm skin — an ode to deep browns in golden light."),
    ("editorial", "Editorial", "Editorial", "editorial",
     "A mixed editorial reel — attitude, wardrobe and negative space."),
    ("men-in-black", "Men in Black - The Red Carpet", "Men in Black: The Red Carpet", "events",
     "Red-carpet coverage for a night of suits, shutters and controlled chaos."),
    ("summerfest", "Westside Summerfest", "Westside Summerfest", "events",
     "Golden-hour performances and crowd swells — three stages, one festival, no missed beat."),
    ("blue-moon-gala", "Once in a Blue Moon Gala", "Once in a Blue Moon Gala", "events",
     "A rare night indeed — tables, toasts and the dance floor after midnight."),
    ("credo-hackathon", "Credo Hackathon", "Credo Hackathon", "events",
     "Forty-eight hours of builders — whiteboards, wireframes and the final-demo high five."),
    ("vmj-book-launch", "VMJ Book Launch", "VMJ Book Launch", "events",
     "Author, audience, applause — the launch of a literary dream, from green room to signing desk."),
    ("abh-merch", "ABH Merch Launch", "ABH Merch Launch", "commercial",
     "Product storytelling for a merch drop — every thread and tag in its best light."),
]

# galleries surfaced as the three large "Selected Work" frames
SHOWCASE = ["headshots-portfolio", "inductees", "crimson"]

def images_in(folder, root=ROOT):
    """Read dimensions without decoding pixels, and encode URL-special filenames."""
    photos = []
    for path in sorted((root / folder).iterdir()):
        if not path.is_file() or path.name.startswith(".") or path.suffix.lower() not in EXTENSIONS:
            continue
        with Image.open(path) as image:
            width, height = image.size
            if image.getexif().get(274) in (5, 6, 7, 8):
                width, height = height, width
        photos.append({"src": quote(path.relative_to(root).as_posix()), "w": width, "h": height})
    return photos


def build_manifest(root=ROOT):
    galleries, seen = [], set()
    for gid, folder, title, category, blurb in GALLERIES:
        if gid in seen:
            raise ValueError("Duplicate gallery id: " + gid)
        seen.add(gid)
        photos = images_in(folder, root)
        if photos:
            galleries.append({"id": gid, "title": title, "cat": category, "desc": blurb, "photos": photos})

    heroes = [photo["src"] for photo in images_in("Hero Images", root)]
    out = [
        "/* AUTO-GENERATED by tools/build_galleries.py — do not edit by hand.",
        "   Image dimensions reserve space for lazy loading without layout shifts.",
        "   Regenerate with: python3 tools/build_galleries.py */",
        "window.OJ_GALLERIES = [",
        ",\n".join(json.dumps(g, ensure_ascii=False, separators=(",", ":")) for g in galleries),
        "];",
        "window.OJ_HEROES = " + json.dumps(heroes, ensure_ascii=False) + ";",
        "window.OJ_SHOWCASE = " + json.dumps(SHOWCASE) + ";",
        "",
    ]
    stats = {"galleries": len(galleries), "photos": sum(len(g["photos"]) for g in galleries), "heroes": len(heroes)}
    return "\n".join(out), stats


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the committed manifest is stale")
    args = parser.parse_args()
    content, stats = build_manifest()
    target = ROOT / "assets/js/galleries.js"
    if args.check:
        if not target.exists() or target.read_text(encoding="utf-8") != content:
            parser.exit(1, "Gallery manifest is stale. Run: python3 tools/build_galleries.py\n")
        print("Gallery manifest is up to date:", stats)
    else:
        target.write_text(content, encoding="utf-8")
        print("Wrote", target, stats)


if __name__ == "__main__":
    main()
