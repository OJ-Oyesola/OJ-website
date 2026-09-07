/* ==========================================================================
   OJ_Oyesola — main site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.OJ_CONFIG || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Portfolio is driven by the on-disk shoot folders (see assets/js/galleries.js).
     Each gallery maps to one top-level folder and lists every real photo in it. */
  var GALLERIES = window.OJ_GALLERIES || [];
  var HEROES = window.OJ_HEROES || [];
  var SHOWCASE = window.OJ_SHOWCASE || [];

  function galById(id) {
    for (var i = 0; i < GALLERIES.length; i++) if (GALLERIES[i].id === id) return GALLERIES[i];
    return null;
  }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice(), j, t;
    for (var i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- Config wiring ---------- */
  function applyConfig() {
    if (CFG.instagram) {
      var ig = $("#igLink");
      if (ig) {
        ig.href = "https://instagram.com/" + CFG.instagram;
        ig.hidden = false;
      }
      var row = $("#igContactRow");
      if (row) {
        $("#igContactLink").href = "https://instagram.com/" + CFG.instagram;
        $("#igContactLink").textContent = "@" + CFG.instagram;
        row.hidden = false;
      }
      var fig = $("#igFooterLink");
      if (fig) {
        fig.href = "https://instagram.com/" + CFG.instagram;
        $("#igFooterText").textContent = "@" + CFG.instagram;
        fig.hidden = false;
      }
    }
    $$("[data-email]").forEach(function (a) { if (CFG.email) a.href = "mailto:" + CFG.email; });
    $$("[data-phone]").forEach(function (a) { if (CFG.whatsapp) a.href = "https://wa.me/" + CFG.whatsapp; });
    var y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* ---------- Header ---------- */
  function initHeader() {
    var header = $("#siteHeader");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Mobile menu ---------- */
  function initMenu() {
    var toggle = $("#navToggle"), menu = $("#mobileMenu");
    if (!toggle || !menu) return;
    var links = $$(".m-link, .m-cta a", menu);
    function setOpen(open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      document.body.style.overflow = open ? "hidden" : "";
    }
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    links.forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  /* ---------- Hero ----------
     The hero photo is picked from the real "Hero Images" set and rotates on every
     page load, then the reveal animation waits for that image to finish loading. */
  function initHero() {
    var hero = $("#hero");
    if (!hero) return;
    var frames = $$(".hero-media img", hero);
    var mark = function () { setTimeout(function () { hero.classList.add("is-loaded"); }, prefersReduced ? 0 : 120); };
    if (!frames.length) { mark(); return; }

    var pool = HEROES.slice(); /* drawn without replacement, so the two desktop
                                  frames are never the same photo */
    var pending = frames.length;
    var settle = function () { if (--pending <= 0) mark(); };

    frames.forEach(function (img) {
      img.addEventListener("load", settle);
      img.addEventListener("error", function () {
        if (img.getAttribute("data-fallback") !== "1") {
          img.setAttribute("data-fallback", "1");
          img.src = "assets/img/hero.jpg"; /* graceful fallback */
          return; /* the retry settles through its own load/error */
        }
        settle();
      });
      if (pool.length) {
        img.src = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      }
      if (img.complete) { img.removeEventListener("load", settle); settle(); }
    });
  }

  /* ---------- Scroll indicator ---------- */
  function initScrollCue() {
    var cue = $("#scrollCue");
    if (!cue) return;
    var update = function () {
      cue.classList.toggle("is-hidden", window.scrollY > 120);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    cue.addEventListener("click", function () {
      var target = $("#selected") || $("#work");
      if (!target) return;
      try { target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" }); }
      catch (e) { target.scrollIntoView(); }
    });
  }

  /* ---------- Scroll reveals ---------- */
  function initReveals() {
    var els = $$(".reveal");
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Counters ---------- */
  function initCounters() {
    var nums = $$("[data-count]");
    if (!nums.length) return;
    function run(el) {
      var target = parseInt(el.getAttribute("data-count"), 10) || 0;
      if (prefersReduced) { el.textContent = target; return; }
      var dur = 1400, start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { run(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    nums.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Selected work (featured frames) ---------- */
  function showcaseList() {
    var wanted = (SHOWCASE.length ? SHOWCASE : GALLERIES.map(function (g) { return g.id; }));
    var list = [], seen = {};
    wanted.forEach(function (id) {
      var g = galById(id);
      if (g && list.length < 3 && !seen[g.id]) { list.push(g); seen[g.id] = true; }
    });
    GALLERIES.forEach(function (g) {
      if (list.length < 3 && !seen[g.id]) { list.push(g); seen[g.id] = true; }
    });
    return list;
  }

  function renderSelectedWork() {
    var wrap = $("#features");
    if (!wrap) return;
    wrap.innerHTML = "";
    showcaseList().forEach(function (g, i) {
      var fig = document.createElement("figure");
      fig.className = "feature reveal";
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "Open " + g.title + " gallery");
      if (i > 0) fig.setAttribute("data-delay", String(i));
      fig.setAttribute("data-collection", g.id);

      var img = document.createElement("img");
      img.src = pick(g.files); /* randomised cover each page load */
      img.alt = g.title + " — " + cap(g.cat) + " collection";
      img.loading = "lazy";

      var capEl = document.createElement("figcaption");
      var inner = document.createElement("div");
      var t = document.createElement("div"); t.className = "f-title"; t.textContent = g.title;
      var c = document.createElement("div"); c.className = "f-cat"; c.textContent = cap(g.cat);
      inner.appendChild(t); inner.appendChild(c);
      var idx = document.createElement("span"); idx.className = "f-index";
      idx.textContent = "Nº " + String(i + 1).padStart(2, "0");
      capEl.appendChild(inner); capEl.appendChild(idx);

      var frame = document.createElement("div");
      frame.className = "f-frame";   /* clips the hover zoom; caption sits below it */
      frame.appendChild(img);

      fig.appendChild(frame); fig.appendChild(capEl);
      wrap.appendChild(fig);
    });
  }

  /* ---------- Portfolio tiles ---------- */
  function renderPortfolio() {
    var box = $("#masonry");
    if (!box) return;
    box.innerHTML = "";
    GALLERIES.forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.setAttribute("data-cat", g.cat);
      b.setAttribute("data-collection", g.id);
      b.setAttribute("aria-label", g.title + " — " + cap(g.cat) + " collection");

      var img = document.createElement("img");
      img.src = pick(g.files); /* randomised cover each page load */
      img.alt = g.title + " — " + cap(g.cat) + " collection";
      img.loading = "lazy";

      var veil = document.createElement("span"); veil.className = "tile-veil";
      var meta = document.createElement("span"); meta.className = "tile-meta";
      var tt = document.createElement("span"); tt.className = "t-title"; tt.textContent = g.title;
      var tc = document.createElement("span"); tc.className = "t-cat"; tc.textContent = cap(g.cat);
      meta.appendChild(tt); meta.appendChild(tc);

      b.appendChild(img); b.appendChild(veil); b.appendChild(meta);
      box.appendChild(b);
    });
    var count = $("#filterCount");
    if (count) count.textContent = GALLERIES.length + (GALLERIES.length === 1 ? " collection" : " collections");
  }

  /* ---------- Portfolio filter ---------- */
  function initFilters() {
    var buttons = $$(".filters button");
    var tiles = $$(".tile");
    var count = $("#filterCount");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        var f = btn.getAttribute("data-filter");
        var shown = 0;
        tiles.forEach(function (tile) {
          var match = f === "all" || tile.getAttribute("data-cat") === f;
          tile.classList.toggle("is-hidden", !match);
          if (match) {
            shown++;
            tile.style.animation = "none";
            void tile.offsetWidth; /* restart entry animation */
            tile.style.animation = "";
          }
        });
        if (count) count.textContent = shown + (shown === 1 ? " collection" : " collections");
      });
    });
  }

  /* ---------- Lightbox (individual photo viewer) ---------- */
  var lb = {
    box: null, items: [], index: 0,
    open: function (items, index) {
      this.items = items || [];
      this.index = index || 0;
      this.box.classList.add("is-open");
      document.body.style.overflow = "hidden";
      this.render();
    },
    close: function () {
      this.box.classList.remove("is-open");
      if (!$("#collectionView") || !$("#collectionView").classList.contains("is-open")) {
        document.body.style.overflow = "";
      }
    },
    move: function (dir) {
      var n = this.items.length;
      if (!n) return;
      this.index = (this.index + dir + n) % n;
      this.render();
    },
    render: function () {
      var it = this.items[this.index];
      if (!it) return;
      $("#lbImg").src = it.src;
      $("#lbImg").alt = it.caption || "";
      $("#lbTitle").textContent = it.title || "";
      $("#lbCat").textContent = it.cat || "";
      $("#lbDesc").textContent = it.desc || "";
      $("#lbCount").textContent = this.items.length > 1
        ? String(this.index + 1).padStart(2, "0") + " / " + String(this.items.length).padStart(2, "0")
        : "";
    }
  };

  function initLightbox() {
    var box = $("#lightbox");
    if (!box) return;
    lb.box = box;
    $("#lbClose").addEventListener("click", function () { lb.close(); });
    $("#lbPrev").addEventListener("click", function () { lb.move(-1); });
    $("#lbNext").addEventListener("click", function () { lb.move(1); });
    var cta = $("#lbCta");
    if (cta) cta.addEventListener("click", function () {
      lb.close();
      closeCollection();
    });
    box.addEventListener("click", function (e) { if (e.target === box) lb.close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") lb.close();
      if (e.key === "ArrowLeft") lb.move(-1);
      if (e.key === "ArrowRight") lb.move(1);
    });
  }

  /* ---------- Collection gallery view (fluid, every photo shown) ---------- */
  var cv = { box: null, current: null };

  function openCollection(id) {
    var data = galById(id);
    if (!data) return;
    cv.current = id;
    var grid = $("#cvGrid");
    grid.innerHTML = "";

    $("#cvTitle").textContent = data.title;
    $("#cvCat").textContent = cap(data.cat);
    $("#cvDesc").textContent = data.desc || "";

    /* every photo from the folder, re-shuffled each time the gallery is opened */
    var photos = shuffle(data.files).map(function (src) {
      return { src: src, title: data.title, cat: cap(data.cat), desc: data.desc || "", caption: data.title };
    });
    var n = photos.length;
    $("#cvCount").textContent = n + (n === 1 ? " frame" : " frames");

    photos.forEach(function (photo, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cv-item";
      cell.setAttribute("aria-label", (data.title || "Collection") + " — photo " + (i + 1));
      var img = document.createElement("img");
      img.src = photo.src;
      img.alt = (data.title || "") + " — photo " + (i + 1);
      img.loading = "lazy";
      var num = document.createElement("span");
      num.className = "cv-num";
      num.textContent = String(i + 1).padStart(2, "0");
      cell.appendChild(img);
      cell.appendChild(num);
      cell.addEventListener("click", (function (idx) {
        return function () { lb.open(photos, idx); };
      })(i));
      grid.appendChild(cell);
    });

    var note = $("#cvNote");
    if (note) note.hidden = true; /* full set present — no "more being curated" note */

    cv.box.classList.add("is-open");
    document.body.style.overflow = "hidden";
    cv.box.scrollTop = 0;
  }

  function closeCollection() {
    if (!cv.box) return;
    cv.box.classList.remove("is-open");
    if (!lb.box || !lb.box.classList.contains("is-open")) {
      document.body.style.overflow = "";
    }
  }

  function initCollections() {
    var box = $("#collectionView");
    if (!box) return;
    cv.box = box;
    $$("[data-collection]").forEach(function (el) {
      function open() {
        openCollection(el.getAttribute("data-collection"));
      }
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open();
      });
      /* tiles are <button>s (Enter/Space handled natively); support non-button openers */
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
    $("#cvBack").addEventListener("click", closeCollection);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("is-open") &&
          !(lb.box && lb.box.classList.contains("is-open"))) {
        closeCollection();
      }
    });
  }

  /* ---------- Testimonials ---------- */
  function initQuotes() {
    var quotes = $$(".quote");
    if (!quotes.length) return;
    var dotsWrap = $("#quoteDots");
    var current = 0, timer = null;
    quotes.forEach(function (_, i) {
      var d = document.createElement("button");
      d.setAttribute("aria-label", "Testimonial " + (i + 1));
      d.addEventListener("click", function () { go(i); reset(); });
      dotsWrap.appendChild(d);
    });
    var dots = $$("button", dotsWrap);
    function go(i) {
      current = (i + quotes.length) % quotes.length;
      quotes.forEach(function (q, n) { q.classList.toggle("is-active", n === current); });
      dots.forEach(function (d, n) { d.classList.toggle("is-active", n === current); });
    }
    function reset() {
      if (timer) clearInterval(timer);
      if (!prefersReduced) timer = setInterval(function () { go(current + 1); }, 6500);
    }
    $("#quotePrev").addEventListener("click", function () { go(current - 1); reset(); });
    $("#quoteNext").addEventListener("click", function () { go(current + 1); reset(); });
    var wrap = $("#quotes");
    wrap.addEventListener("mouseenter", function () { if (timer) clearInterval(timer); });
    wrap.addEventListener("mouseleave", reset);
    go(0); reset();
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    $$(".faq-item").forEach(function (item) {
      var q = $(".faq-q", item);
      q.addEventListener("click", function () {
        var open = item.classList.contains("is-open");
        $$(".faq-item.is-open").forEach(function (o) {
          o.classList.remove("is-open");
          $(".faq-q", o).setAttribute("aria-expanded", "false");
        });
        if (!open) {
          item.classList.add("is-open");
          q.setAttribute("aria-expanded", "true");
        }
      });
    });
  }

  /* ---------- Booking form ---------- */
  var INQUIRY_FLAG = "oj_inquiry_sent";
  function initBookingForm() {
    var form = $("#bookingForm");
    if (!form) return;
    var success = $("#formSuccess");

    try {
      if (window.localStorage.getItem(INQUIRY_FLAG) === "1") {
        form.hidden = true;
        success.hidden = false;
      }
    } catch (e) { /* private mode — ignore */ }

    window.OJForms.handle(form, success, "New Booking Inquiry — OJ_Oyesola Photography",
      "No email service connected yet — your email app is opening with the inquiry pre-filled (see README to connect Formspree).");

    form.addEventListener("submit", function () {
      try { window.localStorage.setItem(INQUIRY_FLAG, "1"); } catch (e) {}
    });

    var again = $("#sendAnother");
    if (again) again.addEventListener("click", function (e) {
      e.preventDefault();
      try { window.localStorage.removeItem(INQUIRY_FLAG); } catch (err) {}
      form.reset();
      form.hidden = false;
      success.hidden = true;
    });
  }

  /* ---------- Active nav on scroll ---------- */
  function initNavSpy() {
    var sections = ["work", "services", "about", "contact"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var links = $$("[data-nav]");
    if (!sections.length || prefersReduced) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + entry.target.id);
          });
        }
      });
    }, { rootMargin: "-38% 0px -55% 0px" });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ---------- Boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderSelectedWork();   /* build the featured frames BEFORE observers/filters run */
    renderPortfolio();      /* build every portfolio tile from the gallery folders */
    applyConfig();
    initHeader();
    initMenu();
    initReveals();
    initCounters();
    initFilters();
    initLightbox();
    initCollections();
    initQuotes();
    initFaq();
    initBookingForm();
    initNavSpy();
    initHero();
    initScrollCue();
  });
})();
