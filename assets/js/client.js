/* ==========================================================================
   OJ_Oyesola — client portal
   Access model: a gallery lives at  galleries/<sha256(email|CODE|salt)>/data.json
   Wrong email+code → the file simply doesn't exist → no entry.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.OJ_CONFIG || {};
  var SALT = (CFG.salt || "oj");
  var $ = function (s, c) { return (c || document).querySelector(s); };

  var state = { data: null, base: "", selected: new Set(), selectMode: false, lbIndex: -1 };

  /* ---------- helpers ---------- */
  function normalizeEmail(e) { return (e || "").trim().toLowerCase(); }
  function normalizeCode(c) { return (c || "").trim().toUpperCase(); }

  function galleryHash(email, code) {
    var payload = normalizeEmail(email) + "|" + normalizeCode(code) + "|" + SALT;
    var bytes = new TextEncoder().encode(payload);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  /* ---------- login ---------- */
  function initLogin() {
    var form = $("#loginForm");
    if (!form) return;
    var errBox = $("#loginError"), errMsg = $("#loginErrorMsg"), btn = $("#loginBtn");

    $("#fillDemo").addEventListener("click", function () {
      $("#g-email").value = "demo@oj-oyesola.com";
      $("#g-code").value = "OJ-DEMO";
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.classList.remove("is-visible");
      var email = $("#g-email").value, code = $("#g-code").value;
      if (!email || !code) { form.reportValidity(); return; }

      if (!window.crypto || !crypto.subtle) {
        errMsg.textContent = "This page needs a secure connection (https). Please open it from the official website.";
        errBox.classList.add("is-visible");
        return;
      }

      btn.disabled = true; btn.textContent = "Opening…";
      galleryHash(email, code).then(function (hash) {
        var base = "galleries/" + hash;
        return fetch(base + "/data.json", { cache: "no-store" }).then(function (res) {
          if (!res.ok) throw new Error("not found");
          return res.json().then(function (data) {
            state.data = data; state.base = base; state.hash = hash;
            openGallery();
          });
        });
      }).catch(function () {
        errMsg.textContent = "We couldn't find a gallery with that email and code. Double-check both — or contact us and we'll resend it.";
        errBox.classList.add("is-visible");
      }).finally(function () {
        btn.disabled = false; btn.textContent = "Access My Gallery";
      });
    });
  }

  /* ---------- gallery rendering ---------- */
  function openGallery() {
    var d = state.data;
    $("#gTitle").textContent = d.title || "Your Gallery";
    $("#gSubtitle").textContent = d.subtitle || "";
    $("#gSubtitle").style.display = d.subtitle ? "" : "none";
    $("#gDate").textContent = d.date || "";
    $("#gDate").style.display = d.date ? "" : "none";
    $("#gCount").textContent = (d.photos ? d.photos.length : 0) + " photos";

    var expired = false;
    if (d.expires) {
      var exp = new Date(d.expires + "T23:59:59");
      expired = !isNaN(exp) && exp < new Date();
    }
    $("#expiredBanner").hidden = !expired;

    if (d.externalUrl) {
      $("#externalWrap").hidden = false;
      var link = $("#externalLink");
      link.href = d.externalUrl;
      $("#photoGrid").innerHTML = "";
      $("#actionBar").classList.remove("is-visible");
      showGallery();
      return;
    }

    $("#externalWrap").hidden = true;
    var grid = $("#photoGrid");
    grid.innerHTML = "";
    (d.photos || []).forEach(function (p, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "photo-cell";
      cell.setAttribute("aria-label", "Photo " + (i + 1));
      cell.innerHTML =
        '<img src="' + state.base + "/" + p.grid + '" alt="Photo ' + (i + 1) + '" loading="lazy">' +
        '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg></span>' +
        '<span class="num">' + String(i + 1).padStart(2, "0") + "</span>";
      cell.addEventListener("click", function () {
        if (state.selectMode) { toggleSelect(i); }
        else { openLightbox(i); }
      });
      grid.appendChild(cell);
    });

    showGallery();
  }

  function showGallery() {
    $("#loginView").style.display = "none";
    $("#galleryView").classList.add("is-active");
    window.scrollTo(0, 0);
  }

  function signOut() {
    state.data = null;
    state.selected.clear();
    state.selectMode = false;
    state.lbIndex = -1;
    $("#galleryView").classList.remove("is-active");
    $("#loginView").style.display = "";
    $("#actionBar").classList.remove("is-visible");
    document.body.classList.remove("select-mode");
    var modeBtn = $("#btnSelectMode");
    if (modeBtn) modeBtn.setAttribute("aria-pressed", "false");
    $("#loginForm").reset();
    window.scrollTo(0, 0);
  }

  /* ---------- selection ---------- */
  function cellAt(i) { return $(".photo-grid").children[i]; }

  function toggleSelect(i) {
    if (state.selected.has(i)) state.selected.delete(i);
    else state.selected.add(i);
    var cell = cellAt(i);
    if (cell) cell.classList.toggle("is-selected", state.selected.has(i));
    syncBar();
  }

  function syncBar() {
    var bar = $("#actionBar");
    var photos = (state.data && state.data.photos) || [];
    var n = state.selected.size;
    $("#abCount").textContent = n + " selected";
    $("#abSelectAll").textContent = (n === photos.length && n > 0) ? "Deselect all" : "Select all";
    /* the bar stays visible while selecting — even with nothing picked yet */
    bar.classList.toggle("is-visible", n > 0 || state.selectMode);
    document.body.classList.toggle("select-mode", state.selectMode);
    var modeBtn = $("#btnSelectMode");
    if (modeBtn) {
      modeBtn.classList.toggle("is-active", state.selectMode);
      modeBtn.setAttribute("aria-pressed", String(state.selectMode));
      modeBtn.innerHTML = state.selectMode
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg> Done selecting'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11.5 11.5 14 15 9.5"/><rect x="4" y="3.5" width="16" height="17" rx="3"/></svg> Select photos';
    }
    var plSel = $("#plSelect");
    if (plSel && state.lbIndex >= 0) {
      var on = state.selected.has(state.lbIndex);
      plSel.textContent = on ? "Selected ✓" : "Select photo";
      plSel.classList.toggle("btn--brass", !on);
    }
  }

  function setSelectMode(on) {
    state.selectMode = on;
    if (!on) {
      state.selected.clear();
      ((state.data && state.data.photos) || []).forEach(function (_, i) {
        var cell = cellAt(i);
        if (cell) cell.classList.remove("is-selected");
      });
    }
    syncBar();
  }

  function selectAll() {
    var photos = (state.data && state.data.photos) || [];
    var allOn = state.selected.size === photos.length && photos.length > 0;
    state.selected.clear();
    if (!allOn) photos.forEach(function (_, i) { state.selected.add(i); });
    photos.forEach(function (_, i) {
      var cell = cellAt(i);
      if (cell) cell.classList.toggle("is-selected", state.selected.has(i));
    });
    /* keep whatever select-mode the user is in — only sync the UI */
    syncBar();
  }

  /* ---------- downloads ---------- */
  function slugTitle() {
    return ((state.data && state.data.title) || "photos").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() || "photos";
  }

  function sequentialDownload(indices) {
    /* fallback when JSZip is unavailable: one file at a time */
    var photos = (state.data && state.data.photos) || [];
    indices.forEach(function (i, n) {
      var p = photos[i];
      if (!p) return;
      setTimeout(function () {
        var a = document.createElement("a");
        a.href = state.base + "/" + p.full;
        a.download = slugTitle() + "-" + String(i + 1).padStart(3, "0") + ".jpg";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, n * 380);
    });
  }

  function downloadIndices(indices, btn) {
    if (!indices || !indices.length) return;
    var photos = (state.data && state.data.photos) || [];
    var files = indices.map(function (i) { return { i: i, p: photos[i] }; }).filter(function (x) { return !!x.p; });
    var label = btn ? btn.innerHTML : null;
    function busy(text) {
      if (!btn) return;
      btn.classList.add("is-busy");
      btn.textContent = text;
    }
    function done() {
      if (!btn) return;
      btn.classList.remove("is-busy");
      btn.innerHTML = label;
    }

    if (window.JSZip) {
      busy("Preparing\u2026 0/" + files.length);
      var zip = new window.JSZip();
      var chain = Promise.resolve();
      files.forEach(function (f, n) {
        chain = chain.then(function () {
          return fetch(state.base + "/" + f.p.full).then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.blob();
          }).then(function (b) {
            zip.file(slugTitle() + "-" + String(f.i + 1).padStart(3, "0") + ".jpg", b);
            busy("Downloading " + (n + 1) + "/" + files.length + "\u2026");
          });
        });
      });
      chain
        .then(function () {
          busy("Packing\u2026");
          return zip.generateAsync({ type: "blob" }, function (meta) {
            busy("Packing " + Math.round(meta.percent) + "%");
          });
        })
        .then(function (blob) {
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = slugTitle() + ".zip";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          done();
        })
        .catch(function () {
          done();
          sequentialDownload(indices);
        });
    } else {
      /* no zip library — download one by one */
      sequentialDownload(indices);
    }
  }

  /* ---------- prints ---------- */
  function requestPrints() {
    var picks = Array.from(state.selected).sort(function (a, b) { return a - b; });
    var list = picks.length ? picks.map(function (i) { return "Photo " + String(i + 1).padStart(2, "0"); }).join(", ") : "All photos";
    var subject = "Print Order — " + ((state.data && state.data.title) || "Gallery");
    var body = "Hello OJ,\n\nI'd like to order prints from \"" + ((state.data && state.data.title) || "my gallery") + "\".\n\nPhotos: " + list +
      "\n\nSizes / finishes I'm interested in:\n\nDelivery address:\n";
    window.location.href = "mailto:" + (CFG.email || "oj.oyesola@gmail.com") +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  /* ---------- lightbox ---------- */
  function openLightbox(i) {
    state.lbIndex = i;
    renderLB();
    $("#photoLightbox").classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function renderLB() {
    var photos = (state.data && state.data.photos) || [];
    var p = photos[state.lbIndex];
    if (!p) return;
    $("#plImg").src = state.base + "/" + p.full;
    $("#plImg").alt = "Photo " + (state.lbIndex + 1);
    $("#plCount").textContent = String(state.lbIndex + 1).padStart(2, "0") + " / " + String(photos.length).padStart(2, "0");
    $("#plTitle").textContent = p.caption || (state.data.title || "");
    $("#plCat").textContent = (state.data.subtitle || "").toUpperCase();
    $("#plDownload").href = state.base + "/" + p.full;
    $("#plDownload").setAttribute("download", ((state.data && state.data.title) || "photo").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() + "-" + String(state.lbIndex + 1).padStart(3, "0") + ".jpg");
    syncBar();
  }
  function closeLightbox() {
    $("#photoLightbox").classList.remove("is-open");
    document.body.style.overflow = "";
    state.lbIndex = -1;
  }
  function moveLB(dir) {
    var n = state.data.photos.length;
    state.lbIndex = (state.lbIndex + dir + n) % n;
    renderLB();
  }

  /* ---------- wire up ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initLogin();
    $("#signOut").addEventListener("click", signOut);

    $("#btnSelectMode").addEventListener("click", function () {
      setSelectMode(!state.selectMode);
    });
    $("#btnDownloadAll").addEventListener("click", function () {
      var photos = (state.data && state.data.photos) || [];
      var all = photos.map(function (_, i) { return i; });
      downloadIndices(all, this);
    });
    $("#btnPrints").addEventListener("click", requestPrints);

    $("#abSelectAll").addEventListener("click", selectAll);
    $("#abClear").addEventListener("click", function () {
      state.selected.clear();
      ((state.data && state.data.photos) || []).forEach(function (_, i) {
        var cell = cellAt(i);
        if (cell) cell.classList.remove("is-selected");
      });
      syncBar();
    });
    $("#abDownload").addEventListener("click", function () {
      if (!state.selected.size) return;
      downloadIndices(Array.from(state.selected).sort(function (a, b) { return a - b; }), this);
    });

    $("#plClose").addEventListener("click", closeLightbox);
    $("#plPrev").addEventListener("click", function () { moveLB(-1); });
    $("#plNext").addEventListener("click", function () { moveLB(1); });
    $("#plSelect").addEventListener("click", function () {
      if (state.lbIndex < 0) return;
      state.selectMode = true;
      toggleSelect(state.lbIndex);
    });
    var plb = $("#photoLightbox");
    plb.addEventListener("click", function (e) { if (e.target === plb) closeLightbox(); });
    document.addEventListener("keydown", function (e) {
      if (!plb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") moveLB(-1);
      if (e.key === "ArrowRight") moveLB(1);
    });
  });
})();
