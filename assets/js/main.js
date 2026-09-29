/* ==========================================================================
   OJ_Oyesola — main site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Portfolio is driven by the on-disk shoot folders (see assets/js/galleries.js).
     Each gallery maps to one top-level folder and lists every real photo in it. */
  var GALLERIES = window.OJ_GALLERIES || [];
  var HEROES = window.OJ_HEROES || [];
  var SHOWCASE = window.OJ_SHOWCASE || [];

  var galleryById = new Map(GALLERIES.map(function (g) { return [g.id, g]; }));
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function galleryLabel(gallery) { return gallery.title + " — " + cap(gallery.cat) + " collection"; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    var a = arr.slice(), j, t;
    for (var i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function galleryImage(photo, alt) {
    var img = document.createElement("img");
    img.alt = alt;
    img.width = photo.w;
    img.height = photo.h;
    img.loading = "lazy";
    img.decoding = "async";
    img.src = photo.src;
    return img;
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
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
    var desktop = window.matchMedia("(min-width: 55rem)");
    function setOpen(open) {
      if (menu.classList.contains("is-open") === open) return;
      toggle.setAttribute("aria-expanded", String(open));
      menu.inert = !open;
      menu.classList.toggle("is-open", open);
      menu.setAttribute("aria-hidden", String(!open));
      document.body.classList.toggle("menu-open", open);
      (open ? links[0] : toggle).focus({ preventScroll: true });
    }
    toggle.addEventListener("click", function () {
      setOpen(!menu.classList.contains("is-open"));
    });
    links.forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });
    desktop.addEventListener("change", function () { if (desktop.matches) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (!menu.classList.contains("is-open") || $("dialog[open]")) return;
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
      if (e.key === "Tab") {
        var stops = [toggle].concat(links);
        var current = stops.indexOf(document.activeElement);
        if (e.shiftKey && current <= 0) { e.preventDefault(); stops[stops.length - 1].focus(); }
        else if (!e.shiftKey && (current < 0 || current === stops.length - 1)) {
          e.preventDefault(); toggle.focus();
        }
      }
    });
  }

  /* ---------- Hero: prioritise the visible frame, never wait on a hidden one ---------- */
  function initHero() {
    var hero = $("#hero");
    if (!hero) return;
    var frames = $$(".hero-media img", hero);
    var pool = shuffle(HEROES);
    var fallback = "assets/img/hero.jpg";
    var timeout;
    function reveal() {
      clearTimeout(timeout);
      hero.classList.add("is-loaded");
    }
    // Slow/broken images must not leave the heading and booking links invisible.
    timeout = setTimeout(reveal, 2500);
    if (!frames.length) { reveal(); return; }
    function loadFrame(img, src, primary) {
      var triedFallback = src === fallback;
      function settled() {
        img.removeEventListener("load", settled);
        img.removeEventListener("error", failed);
        if (primary) reveal();
      }
      function failed() {
        if (triedFallback) { settled(); return; }
        triedFallback = true;
        img.src = fallback;
      }
      img.addEventListener("load", settled);
      img.addEventListener("error", failed);
      img.decoding = "async";
      img.src = src;
      if (img.complete && img.naturalWidth) settled();
    }
    loadFrame(frames[0], pool[0] || fallback, true);
    var wide = window.matchMedia("(min-width: 64rem) and (min-aspect-ratio: 3/2)");
    function loadSecond() {
      if (wide.matches && frames[1] && !frames[1].hasAttribute("src")) {
        loadFrame(frames[1], pool[1] || fallback, false);
      }
    }
    loadSecond();
    wide.addEventListener("change", loadSecond);
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
      target.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth" });
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
      if (prefersReduced || !("IntersectionObserver" in window)) { el.textContent = target; return; }
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
    if (prefersReduced || !("IntersectionObserver" in window)) { nums.forEach(run); return; }
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
      var g = galleryById.get(id);
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
    var fragment = document.createDocumentFragment();
    showcaseList().forEach(function (g, i) {
      var fig = document.createElement("figure");
      fig.className = "feature reveal";
      fig.setAttribute("tabindex", "0");
      fig.setAttribute("role", "button");
      fig.setAttribute("aria-label", "Open " + g.title + " gallery");
      if (i > 0) fig.setAttribute("data-delay", String(i));
      fig.setAttribute("data-collection", g.id);

      var img = galleryImage(pick(g.photos), galleryLabel(g));

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
      fragment.appendChild(fig);
    });
    wrap.replaceChildren(fragment);
  }

  /* ---------- Portfolio tiles ---------- */
  function renderPortfolio() {
    var box = $("#masonry");
    if (!box) return;
    var fragment = document.createDocumentFragment();
    GALLERIES.forEach(function (g) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tile";
      b.setAttribute("data-cat", g.cat);
      b.setAttribute("data-collection", g.id);
      b.setAttribute("aria-label", galleryLabel(g));

      var img = galleryImage(pick(g.photos), galleryLabel(g));

      var veil = document.createElement("span"); veil.className = "tile-veil";
      var meta = document.createElement("span"); meta.className = "tile-meta";
      var tt = document.createElement("span"); tt.className = "t-title"; tt.textContent = g.title;
      var tc = document.createElement("span"); tc.className = "t-cat"; tc.textContent = cap(g.cat);
      meta.appendChild(tt); meta.appendChild(tc);

      b.appendChild(img); b.appendChild(veil); b.appendChild(meta);
      fragment.appendChild(b);
    });
    box.replaceChildren(fragment);
    var count = $("#filterCount");
    if (count) count.textContent = GALLERIES.length + (GALLERIES.length === 1 ? " collection" : " collections");
  }

  /* ---------- Portfolio filter ---------- */
  function initFilters() {
    var buttons = $$(".filters button"), tiles = $$(".tile"), count = $("#filterCount");
    buttons.forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.classList.contains("is-active")));
      btn.addEventListener("click", function () {
        if (btn.classList.contains("is-active")) return;
        buttons.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
          b.setAttribute("aria-pressed", String(b === btn));
        });
        var filter = btn.getAttribute("data-filter"), shown = 0;
        tiles.forEach(function (tile) {
          tile.hidden = filter !== "all" && tile.getAttribute("data-cat") !== filter;
          if (!tile.hidden) shown++;
        });
        // Toggling display restarts the CSS animation without per-tile forced layouts.
        if (count) count.textContent = shown + (shown === 1 ? " collection" : " collections");
      });
    });
  }

  /* Native dialogs isolate page focus, restore the opener and handle topmost Escape. */
  var cv = { box: null, current: null, photos: [] };
  var lb = {
    box: null, index: 0,
    open: function (index) {
      if (!cv.photos[index] || !this.box) return;
      this.index = index;
      this.render();
      if (!this.box.open) this.box.showModal();
    },
    move: function (dir) {
      var n = cv.photos.length;
      if (!n) return;
      this.index = (this.index + dir + n) % n;
      this.render();
    },
    render: function () {
      var photo = cv.photos[this.index], data = cv.current;
      if (!photo || !data) return;
      $("#lbImg").src = photo.src;
      $("#lbImg").alt = data.title + " — photo " + (this.index + 1);
      $("#lbTitle").textContent = data.title;
      $("#lbCat").textContent = cap(data.cat);
      $("#lbDesc").textContent = data.desc || "";
      $("#lbCount").textContent = String(this.index + 1).padStart(2, "0") + " / " +
        String(cv.photos.length).padStart(2, "0");
    }
  };

  function initLightbox() {
    var box = $("#lightbox");
    if (!box) return;
    lb.box = box;
    $("#lbClose").addEventListener("click", function () { closeDialog(box); });
    $("#lbPrev").addEventListener("click", function () { lb.move(-1); });
    $("#lbNext").addEventListener("click", function () { lb.move(1); });
    $("#lbCta").addEventListener("click", closeCollection);
    box.addEventListener("click", function (e) { if (e.target === box) closeDialog(box); });
    box.addEventListener("close", function () { if (!box.open) $("#lbImg").removeAttribute("src"); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); lb.move(e.key === "ArrowLeft" ? -1 : 1);
      }
    });
  }

  /* ---------- Collection gallery view ---------- */
  function openCollection(id) {
    var data = galleryById.get(id);
    if (!data || !cv.box) return;
    cv.current = data;
    cv.photos = shuffle(data.photos);
    $("#cvTitle").textContent = data.title;
    $("#cvCat").textContent = cap(data.cat);
    $("#cvDesc").textContent = data.desc || "";
    $("#cvCount").textContent = cv.photos.length + (cv.photos.length === 1 ? " frame" : " frames");

    var fragment = document.createDocumentFragment();
    cv.photos.forEach(function (photo, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cv-item";
      cell.dataset.index = i;
      var caption = data.title + " — photo " + (i + 1);
      cell.setAttribute("aria-label", caption);
      var num = document.createElement("span");
      num.className = "cv-num";
      num.textContent = String(i + 1).padStart(2, "0");
      cell.append(galleryImage(photo, caption), num);
      fragment.appendChild(cell);
    });
    $("#cvGrid").replaceChildren(fragment);
    if (!cv.box.open) cv.box.showModal();
    cv.box.scrollTop = 0;
  }

  function closeCollection() {
    closeDialog(lb.box);
    closeDialog(cv.box);
  }

  function initCollections() {
    var box = $("#collectionView");
    if (!box) return;
    cv.box = box;
    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-collection]");
      if (trigger) openCollection(trigger.getAttribute("data-collection"));
    });
    document.addEventListener("keydown", function (e) {
      var trigger = e.target.closest("[data-collection]");
      // Native buttons already implement Enter and Space.
      if (!trigger || trigger.tagName === "BUTTON") return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openCollection(trigger.getAttribute("data-collection"));
      }
    });
    $("#cvGrid").addEventListener("click", function (e) {
      var cell = e.target.closest("[data-index]");
      if (cell) lb.open(Number(cell.dataset.index));
    });
    $("#cvBack").addEventListener("click", closeCollection);
    box.addEventListener("close", function () {
      if (box.open) return;
      $("#cvGrid").replaceChildren();
      cv.photos = [];
      cv.current = null;
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
      quotes.forEach(function (q, n) {
        q.classList.toggle("is-active", n === current);
        q.setAttribute("aria-hidden", String(n !== current));
      });
      dots.forEach(function (d, n) {
        d.classList.toggle("is-active", n === current);
        d.setAttribute("aria-pressed", String(n === current));
      });
    }
    function reset() {
      clearInterval(timer);
      if (!prefersReduced && !document.hidden && !wrap.matches(":hover, :focus-within")) {
        timer = setInterval(function () { go(current + 1); }, 6500);
      }
    }
    $("#quotePrev").addEventListener("click", function () { go(current - 1); reset(); });
    $("#quoteNext").addEventListener("click", function () { go(current + 1); reset(); });
    var wrap = $("#quotes");
    wrap.addEventListener("mouseenter", function () { if (timer) clearInterval(timer); });
    wrap.addEventListener("mouseleave", reset);
    wrap.addEventListener("focusin", function () { clearInterval(timer); });
    wrap.addEventListener("focusout", reset);
    document.addEventListener("visibilitychange", reset);
    go(0); reset();
  }

  /* ---------- FAQ ---------- */
  function initFaq() {
    var items = $$(".faq-item");
    function setOpen(item, open) {
      item.classList.toggle("is-open", open);
      $(".faq-q", item).setAttribute("aria-expanded", String(open));
      var answer = $(".faq-a", item);
      answer.inert = !open;
      answer.setAttribute("aria-hidden", String(!open));
    }
    items.forEach(function (item, i) {
      var q = $(".faq-q", item), answer = $(".faq-a", item);
      answer.id = "faq-answer-" + i;
      q.setAttribute("aria-controls", answer.id);
      setOpen(item, item.classList.contains("is-open"));
      q.addEventListener("click", function () {
        var open = !item.classList.contains("is-open");
        items.forEach(function (other) { setOpen(other, other === item && open); });
      });
    });
  }

  /* ---------- Booking form ---------- */
  var INQUIRY_FLAG = "oj_inquiry_confirmed";
  function initBookingForm() {
    var form = $("#bookingForm");
    if (!form) return;
    var success = $("#formSuccess");

    try {
      // The old flag was written before validation/delivery, so cannot be trusted.
      window.localStorage.removeItem("oj_inquiry_sent");
      if (window.localStorage.getItem(INQUIRY_FLAG) === "1") {
        form.hidden = true;
        success.hidden = false;
      }
    } catch (e) { /* private mode — ignore */ }

    window.OJForms.handle(form, success, "New Booking Inquiry — OJ_Oyesola Photography",
      "Your email app is opening with your inquiry. Please send the draft to complete your inquiry.");

    form.addEventListener("oj:form-success", function () {
      try { window.localStorage.setItem(INQUIRY_FLAG, "1"); } catch (e) { /* Storage may be blocked. */ }
    });

    var again = $("#sendAnother");
    if (again) again.addEventListener("click", function (e) {
      e.preventDefault();
      try { window.localStorage.removeItem(INQUIRY_FLAG); } catch (err) { /* Storage may be blocked. */ }
      form.reset();
      form.hidden = false;
      success.hidden = true;
      $("input", form).focus();
    });
  }

  /* ---------- Active nav on scroll ---------- */
  function initNavSpy() {
    var sections = ["work", "services", "about", "contact"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var links = $$("[data-nav]");
    if (!sections.length || !("IntersectionObserver" in window)) return;
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
    initHero();
    renderSelectedWork();   /* build the featured frames BEFORE observers/filters run */
    renderPortfolio();      /* build every portfolio tile from the gallery folders */
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
    initScrollCue();
  });
})();
