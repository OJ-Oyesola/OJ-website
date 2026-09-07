# OJ_Oyesola — Photography Website & Client Gallery

A minimalist portfolio and client image-delivery site for **OJ_Oyesola**
(portrait, event & wedding photography — Ibadan, Nigeria).

**Pure static HTML/CSS/JS:** no framework, production npm installation, server API or
build step required to serve the site. Python tools generate gallery data when
photos change; Node.js is used only for development checks.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Selected work, portfolio, packages, testimonials, about, FAQ and booking |
| `client.html` | Email + access-code gallery lookup, selection, downloads and print requests |
| `contract.html` | Booking agreement and typed-signature form |
| `privacy.html` / `terms.html` | Legal information |
| `404.html` | Not-found page, including nested GitHub Pages URLs |

## Preview locally

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# Open http://localhost:8000
```

The client portal requires HTTPS or `http://localhost` for Web Crypto. Open it
through a server, not `file://`. The site uses current-browser features including
native dialogs, `inert` and CSS `:has()`.

**Demo galleries:** open `client.html`, use `demo@oj-oyesola.com` with `OJ-DEMO`
(portraits) or `OJ-WEDDING` (wedding).

## Development checks

Requires **Node.js 22.13+** and **Python 3.11+**:

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r tools/requirements.txt
npm ci
npx playwright install chromium     # Linux CI: add --with-deps
npm run check                      # lint, manifest freshness, links/assets, Python tests
npm test                           # desktop + mobile Chromium browser tests
```

Tests serve the site under a repository subpath, as GitHub Pages does. They
cover gallery navigation, focus, responsive layout, booking/contract validation,
client access, expiry, ZIP contents, download failures and cancellation.
**Formspree requests are mocked; tests never submit real inquiries or agreements.**
ZIP tests use the pinned development copy of JSZip, not the live CDN.

A preinstalled Chromium can be used by setting `CHROMIUM_EXECUTABLE_PATH`.
`node_modules`, browser reports, caches and virtual environments are ignored by Git.
GitHub Actions runs these checks on pull requests and pushes to `main`.

## Deployment — GitHub Pages

The repository's Pages source is **`main` → `/ (root)`**. The current site is:

**https://oj-oyesola.github.io/OJ-website/**

Pushing a working branch backs up its changes but **does not deploy them**.
Merge its pull request into `main`, then check the **pages build and deployment**
run in GitHub Actions. No production `npm install` or build is needed.

### Custom domain

Configure the domain in **Settings → Pages**, follow GitHub's DNS instructions,
and enable **Enforce HTTPS**. Update:

- `index.html`: Open Graph image/domain metadata.
- `sitemap.xml`: the public page URLs.
- `robots.txt`: the sitemap URL and gallery path for the chosen site root.
- `404.html`: the project-prefix check if the repository path changes.

`robots.txt` is only honoured at an origin's root; a project-site copy is not an
access-control mechanism. Pages marked `noindex` are excluded from the sitemap.

## Configuration — `assets/js/config.js`

| Key | Purpose |
|---|---|
| `formspreeId` | Formspree endpoint ID for booking and contract submissions. Currently `xnpqbjky`. When blank, forms open a prefilled email draft. |
| `email` / `phoneDisplay` / `whatsapp` | Contact links and labelled contact values. WhatsApp uses international digits only. |
| `instagram` | Handle without `@`; leave blank to hide Instagram links. |
| `salt` | **Public lookup namespace, not a secret.** The gallery builder reads this directly from config; keep it double-quoted. Changing it invalidates existing gallery logins unless those galleries are regenerated. |

Only a successful Formspree response displays a delivery confirmation and
remembers a booking as sent. Invalid forms, network errors and email drafts
remain editable and are never remembered as delivered. Visitors must actually
send an email draft themselves. The old, unreliable `oj_inquiry_sent` flag is
cleared; confirmed inquiries use `oj_inquiry_confirmed`.

Formspree notifications/autoresponses must be configured in the Formspree
account. The website does not itself send the client a copy of an agreement.
Legal prose and structured metadata are static; review those when contact or
business details change.

## Important: gallery privacy and expiry

**This is an unlisted static delivery system, not authenticated private storage.**
The portal hashes `email|CODE|salt` to locate `galleries/<sha256>/data.json`.
There is no server checking permission to retrieve the JSON or image files.

- Anyone with a gallery/file URL can access it directly.
- In a public GitHub repository, gallery paths and photos can also be discovered
  in the repository and its history, regardless of access codes.
- Expiry hides photos and delivery controls in the portal after the configured
  date (end of day, **UTC**). It does **not** revoke direct URLs or remove files
  from the host or Git history.
- Hashing and `robots.txt` must not be relied on for confidentiality.

Only publish photos approved for public hosting here. For genuinely private
client deliveries, use a gallery provider with enforced access controls, or a
backend with authentication and protected storage. Do not commit sensitive
client images and assume an access code makes them private.

## Create a client gallery

1. Install Pillow once: `pip install -r tools/requirements.txt`.
2. Put approved photos in a folder and run:

   ```bash
   python3 tools/new_gallery.py \
     --email client@example.com \
     --code OJ-7KQ2-9XMP \
     --title "Ayo & Ola" \
     --subtitle "Wedding" \
     --date "September 2026" \
     --dir /path/to/photos
   ```

3. Commit the generated gallery, push the working branch, and merge into the
   Pages source branch. Wait for deployment before sharing the login details.

The tool respects EXIF orientation, never upscales, and writes:

- `full/`: JPEGs up to 2000px on the long edge (client downloads).
- `grid/`: JPEGs up to 1000px (gallery display).
- `thumbs/`: 420px previews.
- `data.json`: titles, paths, dimensions and expiry (12 calendar months by default).

Use `--expires YYYY-MM-DD` to set another expiry. Existing galleries are protected
unless `--force` is supplied. Replacement outputs are staged first; failed image
processing leaves the existing delivery intact. Successful replacement removes
stale files from the previous version. Keep your original photos separately.

### Externally hosted galleries

Use `--external-url` **instead of** `--dir`; no local images or Pillow are needed:

```bash
python3 tools/new_gallery.py \
  --email client@example.com --code OJ-7KQ2-9XMP --title "Ayo & Ola" \
  --external-url "https://example.com/your-gallery"
```

The portal shows the external link rather than empty selection/download tools.
Choose a provider with appropriate privacy settings for confidential deliveries.

### Client selection and downloads

Clients can browse full-screen, select individual photos or all photos, and
request prints by email. Single-photo downloads are direct. Multiple photos use
one ZIP, with up to three concurrent image requests and progress feedback.
JSZip is loaded on demand from a version-pinned CDN URL with an integrity hash;
if unavailable, the portal falls back to individual downloads (the browser may
ask for permission). Failed photo requests do not produce incomplete ZIPs.
Signing out cancels a pending batch. Large deliveries are better hosted externally,
since ZIP generation holds the selected files in browser memory.

## Portfolio photography

The homepage contains **20 collections / 523 photos**, five hero images and one
about portrait — 529 real photos in total. The original photo files are preserved.

1. Add a photo to a top-level shoot folder, such as `Couples/`.
2. For a new collection, add its `id / folder / title / category / blurb` to
   `GALLERIES` in `tools/build_galleries.py`.
3. Run `python3 tools/build_galleries.py` and include the updated
   `assets/js/galleries.js` in the same change.

The generated manifest lists `{src, w, h}` per photo, plus the hero pool and
selected-work IDs. Dimensions reserve the right space before lazy loading;
URL encoding supports spaces, ampersands and other special filename characters.
The generator reads dimensions without decoding full images and scans each
folder once. `--check` verifies freshness without modifying files.

Collection covers rotate on page load; collection photos shuffle when opened.
The desktop hero shows two distinct frames where space allows, while mobile
loads only the visible frame. A failed/slow image never permanently hides the
hero heading or booking links. Native dialogs provide gallery focus isolation,
keyboard navigation, and one-layer-at-a-time Escape dismissal.

| Static image | Purpose |
|---|---|
| `assets/img/hero.jpg` | Error fallback for the real hero pool |
| `About Page/IMG_9627BW.jpg` | About portrait, referenced directly in `index.html` |
| `assets/img/og.jpg` | Social share image |
| `assets/img/favicon*` | Favicons and touch icon |

## Fonts

Self-hosted Cormorant Garamond (display), Instrument Sans (UI) and Great Vibes
(signature/fallback) use OFL licences. The **Wedding Ampersand** files live at
`assets/fonts/wedding-ampersand.{ttf,woff2}` and are reserved for the `OJ_Oyesola`
wordmark and the “OJ.” About sign-off. Missing glyphs fall back to Great Vibes.

**Licensing:** Wedding Ampersand (Azetype Std.) is free for personal use; confirm
a commercial web-embedding licence before using it commercially.

## Structure

```text
├── *.html                         # public static pages
├── assets/css/                    # shared design + client styles
├── assets/js/                     # config, forms, main, client, contract, generated galleries
├── assets/fonts/ · assets/img/    # static brand assets
├── <shoot folders>/               # original portfolio photographs
├── galleries/<sha256>/            # client data + full/grid/thumbs images
├── tools/                         # gallery generators and offline site checks
├── tests/                         # Python unit + desktop/mobile browser tests
└── .github/workflows/check.yml    # automated checks (not a deployment workflow)
```
