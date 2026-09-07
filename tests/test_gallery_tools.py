import contextlib
import datetime as dt
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
from tools import build_galleries, new_gallery
from tools.check_site import Page


class GalleryToolsTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.photos = self.root / "input"
        self.photos.mkdir()
        self.config = self.root / "assets/js/config.js"
        self.config.parent.mkdir(parents=True)
        self.config.write_text((new_gallery.ROOT / "assets/js/config.js").read_text(encoding="utf-8"), encoding="utf-8")
        for name, value in (("ROOT", self.root), ("GALLERIES", self.root / "galleries")):
            mock = patch.object(new_gallery, name, value)
            mock.start()
            self.addCleanup(mock.stop)
        output = contextlib.redirect_stdout(io.StringIO())
        output.__enter__()
        self.addCleanup(output.__exit__, None, None, None)

    def args(self, *extra):
        return new_gallery.parse_args(["--email", "client@example.com", "--code", "TEST-CODE", *extra])

    def image(self, name="001.jpg", size=(80, 120), orientation=None, folder=None):
        path = (folder or self.photos) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        exif = Image.Exif()
        if orientation:
            exif[274] = orientation
        Image.new("RGB", size, "#765432").save(path, exif=exif)
        return path

    def test_hash_normalisation_matches_existing_demo(self):
        self.assertEqual(new_gallery.gallery_hash("  DEMO@OJ-OYESOLA.COM ", " oj-demo "),
                         "e5edec8a25350838873d0e638ce864b060c185a80fcd86265789500f527559d5")

    def test_salt_is_read_from_config_not_duplicated(self):
        old_hash = new_gallery.gallery_hash("client@example.com", "TEST")
        self.config.write_text('window.OJ_CONFIG = {\n  salt: "new-test-salt"\n};\n', encoding="utf-8")
        self.assertNotEqual(new_gallery.gallery_hash("client@example.com", "TEST"), old_hash)
        self.config.write_text('window.OJ_CONFIG = {};', encoding="utf-8")
        with self.assertRaises(ValueError):
            new_gallery.gallery_hash("client@example.com", "TEST")

    def test_external_gallery_needs_neither_photo_folder_nor_pillow(self):
        args = self.args("--external-url", "https://example.com/gallery", "--expires", "2030-01-01")
        with patch.dict("sys.modules", {"PIL": None}):
            dest = new_gallery.build(args)
        data = json.loads((dest / "data.json").read_text())
        self.assertEqual(data["externalUrl"], "https://example.com/gallery")
        self.assertEqual(data["photos"], [])
        self.assertEqual(list(dest.iterdir()), [dest / "data.json"])

    def test_local_gallery_respects_exif_and_does_not_upscale(self):
        self.image(size=(200, 100), orientation=6)
        dest = new_gallery.build(self.args("--dir", str(self.photos)))
        data = json.loads((dest / "data.json").read_text())
        photo = data["photos"][0]
        self.assertEqual((photo["w"], photo["h"]), (100, 200))
        for key in ("full", "grid", "thumb"):
            with Image.open(dest / photo[key]) as image:
                self.assertEqual(image.size, (100, 200))
                self.assertNotIn(274, image.getexif())

    def test_resize_keeps_limits_and_aspect_ratio(self):
        self.image(size=(3000, 1500))
        dest = new_gallery.build(self.args("--dir", str(self.photos)))
        for folder, expected in (("full", (2000, 1000)), ("grid", (1000, 500)), ("thumbs", (420, 210))):
            with Image.open(dest / folder / "001.jpg") as image:
                self.assertEqual(image.size, expected)

    def test_force_removes_stale_files_and_failed_build_preserves_delivery(self):
        self.image("001.jpg")
        second = self.image("002.jpg")
        args = self.args("--dir", str(self.photos))
        dest = new_gallery.build(args)
        original = (dest / "data.json").read_bytes()
        with self.assertRaises(ValueError):
            new_gallery.build(args)
        args.force = True
        second.write_bytes(b"not an image")
        with self.assertRaises(OSError):
            new_gallery.build(args)
        self.assertEqual((dest / "data.json").read_bytes(), original)
        self.assertTrue((dest / "full/002.jpg").exists())
        self.assertEqual(list(dest.parent.glob(".gallery-*")), [])
        second.unlink()
        new_gallery.build(args)
        self.assertEqual(len(json.loads((dest / "data.json").read_text())["photos"]), 1)
        for size in ("full", "grid", "thumbs"):
            self.assertFalse((dest / size / "002.jpg").exists())

    def test_failed_publish_restores_previous_gallery(self):
        self.image()
        args = self.args("--dir", str(self.photos))
        dest = new_gallery.build(args)
        original = (dest / "data.json").read_bytes()
        args.force = True
        rename = Path.rename

        def fail_new_directory(path, target):
            if path.name == "new":
                raise OSError("Simulated publish failure")
            return rename(path, target)

        with patch.object(Path, "rename", fail_new_directory), self.assertRaises(OSError):
            new_gallery.build(args)
        self.assertEqual((dest / "data.json").read_bytes(), original)
        self.assertTrue((dest / "full/001.jpg").exists())

    def test_cli_rejects_invalid_source_expiry_and_external_url(self):
        cases = [[], ["--dir", str(self.photos), "--external-url", "https://example.com"],
                 ["--external-url", "javascript:alert(1)"], ["--external-url", "//example.com"],
                 ["--external-url", "https://user:password@example.com"],
                 ["--dir", str(self.photos), "--expires", "2026-02-30"],
                 ["--dir", str(self.photos), "--expires", "20270101"]]
        for args in cases:
            with self.subTest(args=args), contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                self.args(*args)

    def test_empty_code_and_empty_photo_folder_fail_without_creating_gallery(self):
        with self.assertRaises(ValueError):
            new_gallery.build(self.args("--dir", str(self.photos)))
        args = self.args("--external-url", "https://example.com")
        args.code = "  "
        with self.assertRaises(ValueError):
            new_gallery.build(args)
        self.assertFalse(new_gallery.GALLERIES.exists())

    def test_expiry_is_twelve_calendar_months_on_leap_day(self):
        class LeapDay(dt.date):
            @classmethod
            def today(cls):
                return cls(2024, 2, 29)
        with patch.object(new_gallery.dt, "date", LeapDay):
            self.assertEqual(new_gallery.default_expiry(), "2025-02-28")

    def test_manifest_encodes_paths_dimensions_and_skips_empty_collections(self):
        folder = self.root / "Album One"
        self.image("photo #1 & 2.JPG", (80, 120), 6, folder)
        (self.root / "Empty").mkdir()
        self.image(folder=self.root / "Hero Images")
        collections = [("album", "Album One", "Album", "portraits", "Description"),
                       ("empty", "Empty", "Empty", "portraits", "")]
        with patch.object(build_galleries, "GALLERIES", collections):
            first, stats = build_galleries.build_manifest(self.root)
            second, _ = build_galleries.build_manifest(self.root)
        data = json.loads(first.split("window.OJ_GALLERIES = ", 1)[1].split(";", 1)[0])
        self.assertEqual(first, second)
        self.assertEqual(stats, {"galleries": 1, "photos": 1, "heroes": 1})
        self.assertEqual(data[0]["photos"], [{"src": "Album%20One/photo%20%231%20%26%202.JPG", "w": 120, "h": 80}])

    def test_manifest_duplicate_ids_are_rejected_even_for_empty_folders(self):
        (self.root / "Empty").mkdir()
        entry = ("same", "Empty", "Empty", "portraits", "")
        with patch.object(build_galleries, "GALLERIES", [entry, entry]), self.assertRaises(ValueError):
            build_galleries.build_manifest(self.root)

    def test_html_checker_catches_duplicate_ids_and_empty_image_sources(self):
        path = self.root / "bad.html"
        path.write_text('<html><body><div id="same"></div><img id="same" src=""></body></html>')
        errors = Page(path).errors
        self.assertIn("Duplicate id: same", errors)
        self.assertIn("Empty src on <img>", errors)
        self.assertIn("Image is missing alt text", errors)


if __name__ == "__main__":
    unittest.main()
