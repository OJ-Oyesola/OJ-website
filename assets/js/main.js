/* ==========================================================================
   OJ_Oyesola — main site behaviour
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.OJ_CONFIG || {};
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

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var box = $("#lightbox");
    if (!box) return;
    var items = $$("[data-lb]");
    var visible = [];
    var idx = 0;
    var img = $("#lbImg"), title = $("#lbTitle"), cat = $("#lbCat"),
        desc = $("#lbDesc"), counter = $("#lbCount");

    function currentList() {
      return items.filter(function (el) {
        if (el.classList.contains("tile")) return !el.classList.contains("is-hidden");
        return true; /* features are always visible */
      });
    }
    function render() {
      var el = visible[idx];
      if (!el) return;
      var src = el.getAttribute("data-img") || (el.querySelector("img") || {}).src || "";
      img.src = src;
      img.alt = el.getAttribute("data-title") || "";
      title.textContent = el.getAttribute("data-title") || "";
      cat.textContent = (el.getAttribute("data-cat") || "").toUpperCase();
      desc.textContent = el.getAttribute("data-desc") || "";
      counter.textContent = String(idx + 1).padStart(2, "0") + " / " + String(visible.length).padStart(2, "0");
    }
    function open(el) {
      visible = currentList();
      idx = visible.indexOf(el);
      if (idx < 0) { visible.push(el); idx = visible.length - 1; }
      render();
      box.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      box.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    function move(dir) {
      idx = (idx + dir + visible.length) % visible.length;
      render();
    }
    items.forEach(function (el) {
      if (el.tagName !== "BUTTON" && el.tagName !== "A") {
        el.tabIndex = 0;
        el.setAttribute("role", "button");
      }
      el.addEventListener("click", function (e) {
        e.preventDefault();
        open(el);
      });
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(el);
        }
      });
    });
    $("#lbClose").addEventListener("click", close);
    $("#lbPrev").addEventListener("click", function () { move(-1); });
    $("#lbNext").addEventListener("click", function () { move(1); });
    var cta = $("#lbCta");
    if (cta) cta.addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
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

  /* ---------- Forms (via shared OJForms: Formspree + graceful fallback) ---------- */
  function initBookingForm() {
    var form = $("#bookingForm");
    if (!form) return;
    window.OJForms.handle(
      form,
      $("#formSuccess"),
      "New Booking Inquiry — OJ_Oyesola Photography",
      "No email service connected yet — your email app is opening with the inquiry pre-filled (see README to connect Formspree)."
    );
    var again = $("#sendAnother");
    if (again) again.addEventListener("click", function (e) {
      e.preventDefault();
      form.reset();
      form.hidden = false;
      $("#formSuccess").hidden = true;
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
    initQuotes();
    initFaq();
    initBookingForm();
    initNavSpy();
  });
})();
