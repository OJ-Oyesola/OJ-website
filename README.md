# OJ_Oyesola — Photography Website & Client Gallery

A minimalist portfolio and client image-delivery platform for **OJ_Oyesola**
(portrait, event & wedding photography — Ibadan, Nigeria).

Built as a **pure static site** — no build step, no framework, no server bills.
Every page is hand-crafted HTML/CSS/JS that can be hosted anywhere for free.

---

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Home, selected work, portfolio, packages, testimonials, about, FAQ, booking form |
| `client.html` | **Client portal** — clients log in with email + access code to view/download/order prints |
| `contract.html` | Booking agreement + typed e-signature |
| `privacy.html` / `terms.html` | Legal (content as provided by OJ) |
| `404.html` | Custom not-found page |

---

## Run it locally

Any static server works:

```bash
cd OJ-website
python3 -m http.server 8000
# → http://localhost:8000
```

> Note: the client portal uses the browser's Web Crypto API, which requires
> `http://localhost` or HTTPS — both are satisfied on GitHub Pages and any
> real host. Opening `client.html` directly from disk (`file://`) will not work.

**Try the demo gallery:** open `client.html` → email `demo@oj-oyesola.com`,
code `OJ-DEMO`.

---

## Deploy (recommended: GitHub Pages — free)

1. Push this repository to GitHub (already done in this workspace).
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)` → Save**.
3. Your site goes live at `https://<username>.github.io/OJ-website/`.

### Custom domain (optional, recommended)

1. Buy a domain (e.g. `oj-oyesola.com` — ~₦5–15k/yr from QServers, Whogohost, Namecheap…).
2. In **Settings → Pages → Custom domain**, enter it and follow the DNS instructions
   (an `A` record / `CNAME` at your registrar).
3. Then update the placeholder domain in **three places**:
   - `index.html` → `og:image` meta tag
   - `sitemap.xml` → every `<loc>` and `robots.txt` → `Sitemap:` line
4. Tick **Enforce HTTPS** in the Pages settings.

---

## Configuration — `assets/js/config.js`

Everything editable in one small file:

| Key | What it does |
|---|---|
| `formspreeId` | **Connect the forms to your email.** Create a free form at [formspree.io](https://formspree.io) (free tier = 50 submissions/month), copy the ID from your endpoint `https://formspree.io/f/XXXXXXXX` into this field. Until set, the booking + contract forms gracefully fall back to opening the visitor's email app pre-filled. |
| `email` / `phoneDisplay` / `whatsapp` | Contact details shown around the site. |
| `instagram` | Your handle **without** the `@`. The Instagram links appear automatically once set. |
| `salt` | Secret string used to hash client gallery logins. **Change it once before going live** (any long random string), then update the same value in `tools/new_gallery.py`. |

---

## Delivering photos to a client (the everyday flow)

1. Put the client's finished photos in a folder on your computer (JPGs, any size).
2. Run:

   ```bash
   pip install Pillow                      # once
   python3 tools/new_gallery.py \
     --email    client@example.com \
     --code     OJ-7KQ2-9XMP \
     --title    "Ayo & Ola" \
     --subtitle "Wedding" \
     --date     "March 2026" \
     --dir      /path/to/their-photos
   ```

3. Commit + push (or re-run deploy). The gallery appears instantly at
   `client.html` when the client enters **that exact email + code**.
4. Message the client their email + code. They can **select, download,
   request prints, and browse full-screen** — gallery auto-expires after
   12 months (customise with `--expires`).

For very large weddings, you can instead point a gallery at an external host:

```bash
python3 tools/new_gallery.py --email ... --code ... --title "..." \
  --external-url "https://pixieset.com/your-gallery"
```

The portal then shows a card linking the client there.

**How private is it?** The same model used by Pixieset/Pic-Time "unlisted"
galleries: there is no list of galleries anywhere in the code — the folder name
is a SHA-256 hash of email + code + salt, so nobody can stumble on a gallery
without both pieces. (True password *authentication* would require a paid
backend; if you ever need it, that's the upgrade path.)

---

## Swapping in real photography

All current images are **placeholders** (AI-generated stand-ins) so the design
could be built before the real work arrived. To replace them:

| Slot | Files |
|---|---|
| Hero | `assets/img/hero.jpg` (16:9, ~1920px wide) |
| About portrait | `assets/img/about.jpg` (4:5) |
| Selected-work features | `assets/img/feature-*.jpg` |
| Portfolio covers (19 collections) | `assets/img/covers/<collection>.jpg` |

Replace a file **keeping the same name**, sized similarly — done.
To add more photos inside a collection later, the lightbox can be extended
(or link the tile to a client gallery).

---

## Brand font — “Wedding Ampersand”

The wordmark and script accents currently use *Great Vibes* as a stand-in.
To install your real font:

1. Put `Wedding Ampersand Font.ttf` at `assets/fonts/wedding-ampersand.ttf`
   (and ideally a `.woff2` copy — convert with
   [fonttools](https://fonttools.readthedocs.io): `pip install fonttools brotli` then
   `python -c "from fontTools.ttLib import TTFont; f=TTFont('Wedding Ampersand Font.ttf'); f.flavor='woff2'; f.save('assets/fonts/wedding-ampersand.woff2')"`).
2. Nothing else — the CSS stack `'Wedding Ampersand', 'Great Vibes'` picks it up
   automatically everywhere it's referenced (`.brand`, `.hero-title .forever`,
   `.signoff`, signatures).

> **Licensing note:** *Wedding Ampersand* (Azetype Std.) is free for personal
> use; embedding it in a commercial website technically requires a licence
> from Creative Market (~$15–20).

## Other fonts (self-hosted, free — OFL)

- **Cormorant Garamond** — display serif
- **Instrument Sans** — UI/body
- **Great Vibes** — script fallback

---

## Structure

```
├── index.html            # main one-page site
├── client.html           # client portal (login → gallery)
├── contract.html         # booking agreement + e-sign
├── privacy.html          # privacy policy
├── terms.html            # terms & conditions
├── 404.html              # custom not-found
├── robots.txt · sitemap.xml · site.webmanifest
├── assets/
│   ├── css/              # main.css (site) · client.css (portal)
│   ├── js/               # config.js ← edit this · main/client/contract/forms.js
│   ├── fonts/            # self-hosted woff2
│   └── img/              # hero, about, features, covers/, og, favicons
├── galleries/            # one folder per client gallery (hashed)
│   └── <sha256>/         # data.json + full/ + grid/ + thumbs/
└── tools/
    └── new_gallery.py    # builds a client gallery from a photo folder
```

---

## Maintenance checklist

- [x] Set `formspreeId` in `assets/js/config.js` → `xnpqbjky` ✓
- [x] Set `instagram` handle → `oj_oyesola` ✓
- [ ] Replace placeholder images with real photography
- [ ] Drop in the real brand font (see above)
- [ ] Change `salt` (config.js **and** tools/new_gallery.py) before first real delivery
- [ ] Update `og:image` / sitemap / robots URLs when the custom domain is attached
