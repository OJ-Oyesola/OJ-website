/* ==========================================================================
   OJ_Oyesola — main site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.OJ_CONFIG || {};
  var COLLECTIONS = window.OJ_COLLECTIONS || {};
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ---------- Hero load ---------- */
  function initHero() {
    var hero = $("#hero");
    if (!hero) return;
    var img = $(".hero-media img", hero);
    var mark = function () { setTimeout(function () { hero.classList.add("is-loaded"); }, prefersReduced ? 0 : 120); };
    if (img && img.complete) mark();
    else if (img) img.addEventListener("load", mark);
    else mark();
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

  /* ---------- Collection gallery view (bento) ---------- */
  var cv = { box: null, current: null };

  function bentoSpans(w, h, i, total) {
    /* returns [colSpan, rowSpan] for a pleasing dense bento layout */
    var ratio = (w || 1) / (h || 1);
    if (total === 1) return [4, 4];
    if (total === 2) return [3, 3];
    if (i === 0) {                       /* hero frame */
      if (ratio >= 1.15) return [4, 3];
      if (ratio <= 0.85) return [3, 4];
      return [3, 3];
    }
    if (ratio >= 1.15) return [3, 2];
    if (ratio <= 0.85) return [2, 3];
    return [2, 2];
  }

  function openCollection(slug) {
    var data = COLLECTIONS[slug];
    if (!data) return;
    cv.current = slug;
    var grid = $("#cvGrid");
    grid.innerHTML = "";

    $("#cvTitle").textContent = data.title || slug;
    $("#cvCat").textContent = (data.cat || "").toUpperCase();
    $("#cvDesc").textContent = data.desc || "";
    var imgs = data.images || [];
    $("#cvCount").textContent = imgs.length + (imgs.length === 1 ? " frame" : " frames");

    var maxCols = window.matchMedia("(max-width: 48rem)").matches ? 2 : 6;
    imgs.forEach(function (im, i) {
      var spans = bentoSpans(im.w, im.h, i, imgs.length);
      var colSpan = Math.min(spans[0], maxCols);
      var rowSpan = spans[1];
      if (maxCols === 2) rowSpan = Math.min(rowSpan, colSpan >= 2 ? 3 : 4);
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cv-item";
      cell.setAttribute("aria-label", (data.title || "Collection") + " — photo " + (i + 1));
      cell.style.gridColumn = "span " + colSpan;
      cell.style.gridRow = "span " + rowSpan;
      cell.innerHTML =
        '<img src="' + im.src + '" alt="' + (data.title || "") + " — photo " + (i + 1) + '" loading="lazy">' +
        '<span class="cv-num">' + String(i + 1).padStart(2, "0") + "</span>";
      cell.addEventListener("click", function () {
        lb.open(imgs.map(function (x) {
          return { src: x.src, title: data.title, cat: (data.cat || "").toUpperCase(), desc: "", caption: data.title };
        }), i);
      });
      grid.appendChild(cell);
    });

    var note = $("#cvNote");
    if (imgs.length < 3) {
      note.innerHTML = (imgs.length === 1
        ? "A selected frame from this collection — more is being curated."
        : "Selected frames from this collection — more is being curated.") +
        '<br><a class="text-link" href="#contact" id="cvCta">Book a session to begin yours ' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h16M13 5l7 7-7 7"/></svg></a>';
      note.hidden = false;
      $("#cvCta").addEventListener("click", closeCollection);
    } else {
      note.hidden = true;
    }

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
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openCollection(el.getAttribute("data-collection"));
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

    /* returning visitor who already inquired → show the receipt state */
    try {
      if (window.localStorage.getItem(INQUIRY_FLAG) === "1") {
        form.hidden = true;
        success.hidden = false;
      }
    } catch (e) { /* private mode — ignore */ }

    window.OJForms.handle(form, success, "New Booking Inquiry — OJ_Oyesola Photography",
      "No email service connected yet — your email app is opening with the inquiry pre-filled (see README to connect Formspree).");

    /* mark as sent on the form's own submit event too (covers the fallback path) */
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
    applyConfig();
    initHeader();
    initMenu();
    initHero();
    initReveals();
    initCounters();
    initFilters();
    initLightbox();
    initCollections();
    initQuotes();
    initFaq();
    initBookingForm();
    initNavSpy();
  });
})();
