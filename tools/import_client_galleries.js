#!/usr/bin/env node
"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const DEMO_GALLERY_HASHES = [
  "e5edec8a25350838873d0e638ce864b060c185a80fcd86265789500f527559d5",
  "c140eca7fd6f7d51802def97df3bd1cdc0528f94c6d193ff62a9440f09cb7da9"
];

function usage() {
  console.log(`Usage:
  node tools/import_client_galleries.js --api-base https://your-worker.workers.dev [options] [gallery-dir ...]

Options:
  --admin-token <token>   Worker admin token. Defaults to ADMIN_API_TOKEN env.
  --api-base <url>        Cloudflare Worker base URL. Defaults to ADMIN_API_BASE env,
                          then cloudflare/resources.json worker.url when available.
  --visibility <value>    Gallery visibility: private or public. Default: private.
  --demo-only             Import only the two bundled demo galleries.
  --dry-run               Print intended actions without sending API requests.
  --help                  Show this help.

Examples:
  node tools/import_client_galleries.js \
    --api-base https://oj-website-api.example.workers.dev \
    --admin-token "$ADMIN_API_TOKEN"

  node tools/import_client_galleries.js \
    --demo-only \
    --admin-token "$ADMIN_API_TOKEN"

  node tools/import_client_galleries.js \
    --api-base https://oj-website-api.example.workers.dev \
    galleries/c140eca7fd6f7d51802def97df3bd1cdc0528f94c6d193ff62a9440f09cb7da9
`);
}

function parseArgs(argv) {
  const options = {
    apiBase: process.env.ADMIN_API_BASE || "",
    adminToken: process.env.ADMIN_API_TOKEN || "",
    visibility: "private",
    demoOnly: false,
    dryRun: false,
    galleryDirs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--demo-only") {
      options.demoOnly = true;
    } else if (arg === "--api-base") {
      options.apiBase = argv[++index] || "";
    } else if (arg === "--admin-token") {
      options.adminToken = argv[++index] || "";
    } else if (arg === "--visibility") {
      options.visibility = String(argv[++index] || "").trim().toLowerCase();
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      options.galleryDirs.push(arg);
    }
  }
  return options;
}

function normalizeBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client-gallery";
}

function isGalleryHash(value) {
  return /^[a-f0-9]{64}$/i.test(String(value || ""));
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function getGalleryDirectories(inputDirs, demoOnly) {
  if (inputDirs.length) return inputDirs;
  const root = path.join(process.cwd(), "galleries");
  if (demoOnly) return DEMO_GALLERY_HASHES.map((hash) => path.join(root, hash));
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isGalleryHash(entry.name)) continue;
    const dataPath = path.join(root, entry.name, "data.json");
    try {
      await fs.access(dataPath);
      dirs.push(path.join(root, entry.name));
    } catch {
      // Ignore directories without a manifest.
    }
  }
  return dirs.sort();
}

async function resolveApiBase(explicitBase) {
  const normalized = normalizeBase(explicitBase);
  if (normalized) return normalized;
  try {
    const manifestPath = path.join(process.cwd(), "cloudflare", "resources.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return normalizeBase(manifest && manifest.worker && (manifest.worker.url || manifest.worker.workers_dev_url) || "");
  } catch {
    return "";
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function apiFetch(base, token, pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  const response = await fetch(base + pathname, { ...init, headers });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const detail = payload && typeof payload === "object" ? (payload.error || payload.detail || JSON.stringify(payload)) : String(payload || response.statusText);
    throw new Error(`${init.method || "GET"} ${pathname} failed: ${response.status} ${detail}`);
  }
  return payload;
}

function plannedUploads(galleryDir, manifest, visibility) {
  return (manifest.photos || []).flatMap((photo, index) => {
    const photoKey = `photo-${String(index + 1).padStart(3, "0")}`;
    const altText = `${manifest.title || "Client gallery"} — Photo ${String(index + 1).padStart(3, "0")}`;
    return [
      { variant: "grid", relativePath: photo.grid, setAsCover: index === 0, position: index, width: photo.w, height: photo.h, title: photoKey, altText },
      { variant: "original", relativePath: photo.full, setAsCover: false, position: index, width: photo.w, height: photo.h, title: photoKey, altText },
      { variant: "thumb", relativePath: photo.thumb, setAsCover: false, position: index, width: photo.w, height: photo.h, title: photoKey, altText }
    ].map((item) => ({ ...item, absolutePath: path.join(galleryDir, item.relativePath), isPublic: visibility === "public" }));
  });
}

async function uploadFile(base, token, slug, upload) {
  const bytes = await fs.readFile(upload.absolutePath);
  const form = new FormData();
  form.set("variant", upload.variant);
  form.set("title", upload.title);
  form.set("altText", upload.altText);
  form.set("position", String(upload.position));
  if (Number.isFinite(Number(upload.width)) && Number(upload.width) > 0) form.set("width", String(upload.width));
  if (Number.isFinite(Number(upload.height)) && Number(upload.height) > 0) form.set("height", String(upload.height));
  form.set("isPublic", upload.isPublic ? "1" : "0");
  if (upload.setAsCover) form.set("setAsCover", "1");
  form.append("file", new Blob([bytes], { type: guessMime(upload.absolutePath) }), path.basename(upload.absolutePath));
  return apiFetch(base, token, `/api/admin/galleries/${encodeURIComponent(slug)}/uploads`, { method: "POST", body: form });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  options.apiBase = await resolveApiBase(options.apiBase);
  if (!options.apiBase) throw new Error("Provide --api-base, set ADMIN_API_BASE, or persist cloudflare/resources.json worker.url first.");
  if (!options.dryRun && !options.adminToken) throw new Error("Provide --admin-token or set ADMIN_API_TOKEN.");
  if (!["private", "public"].includes(options.visibility)) throw new Error("--visibility must be private or public.");

  const galleryDirs = await getGalleryDirectories(options.galleryDirs, options.demoOnly);
  if (!galleryDirs.length) {
    console.log("No gallery directories found to import.");
    return;
  }

  const existing = options.dryRun ? { galleries: [] } : await apiFetch(options.apiBase, options.adminToken, "/api/admin/galleries");
  const existingSlugs = new Set((existing.galleries || []).map((gallery) => gallery.slug));

  let imported = 0;
  let skipped = 0;
  for (const galleryDir of galleryDirs) {
    const hash = path.basename(galleryDir).toLowerCase();
    if (!isGalleryHash(hash)) throw new Error(`Gallery directory name must be a 64-character lookup hash: ${galleryDir}`);
    const manifestPath = path.join(galleryDir, "data.json");
    const manifest = await readJson(manifestPath);
    const slug = `${slugify(manifest.title)}-${hash.slice(0, 8)}`;
    const createBody = {
      kind: "client",
      slug,
      title: String(manifest.title || slug).trim(),
      subtitle: String(manifest.subtitle || "").trim(),
      category: String(manifest.date || "").trim(),
      visibility: options.visibility,
      accessCodeHash: hash,
      expiresAt: String(manifest.expires || "").trim()
    };
    const uploads = plannedUploads(galleryDir, manifest, options.visibility);
    const missing = [];
    for (const upload of uploads) {
      try {
        await fs.access(upload.absolutePath);
      } catch {
        missing.push(upload.relativePath);
      }
    }
    if (missing.length) throw new Error(`Gallery ${galleryDir} is missing files referenced by data.json: ${missing.join(", ")}`);

    if (existingSlugs.has(slug)) {
      skipped += 1;
      console.log(`Skipping ${slug}: gallery already exists in the Worker backend.`);
      continue;
    }

    if (options.dryRun) {
      console.log(`Would create ${slug} from ${galleryDir} with ${uploads.length} uploads.`);
      imported += 1;
      continue;
    }

    console.log(`Creating ${slug} from ${galleryDir}...`);
    await apiFetch(options.apiBase, options.adminToken, "/api/admin/galleries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createBody)
    });

    for (const upload of uploads) {
      console.log(`  uploading ${upload.variant}: ${upload.relativePath}`);
      await uploadFile(options.apiBase, options.adminToken, slug, upload);
    }

    existingSlugs.add(slug);
    imported += 1;
  }

  console.log(`Done. Imported ${imported} galleries${options.dryRun ? " (dry run)" : ""}; skipped ${skipped}.`);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
