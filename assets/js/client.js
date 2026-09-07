/* Client portal for unlisted static galleries; access codes are not authentication. */
(function () {
  "use strict";
  var CFG = window.OJ_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var state = { data: null, base: "", expired: false, selected: new Set(), selectMode: false, lbIndex: -1, download: null };
  var zipPromise;

  function photos() {
    return state.data && !state.expired && !state.data.externalUrl ? state.data.photos : [];
  }
  function slugTitle() {
    return ((state.data && state.data.title) || "photos").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").toLowerCase() || "photos";
  }
  function photoUrl(path) {
    return state.base + "/" + path.split("/").map(encodeURIComponent).join("/");
  }
  function photoName(i) { return slugTitle() + "-" + String(i + 1).padStart(3, "0") + ".jpg"; }

  async function galleryHash(email, code) {
    var bytes = new TextEncoder().encode(email + "|" + code + "|" + CFG.salt);
    var digest = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  function validateGallery(data) {
    if (!data || typeof data !== "object") throw new Error("Invalid gallery");
    ["title", "subtitle", "date", "expires", "externalUrl"].forEach(function (key) {
      if (data[key] !== undefined && typeof data[key] !== "string") throw new Error("Invalid gallery metadata");
    });
    if (data.expires) {
      var date = new Date(data.expires + "T00:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.expires) || !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== data.expires) throw new Error("Invalid expiry date");
    }
    if (data.externalUrl) {
      var url = new URL(data.externalUrl);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid external URL");
    }
    if (data.externalUrl && data.photos === undefined) data.photos = [];
    if (!Array.isArray(data.photos)) throw new Error("Invalid photos");
    data.photos.forEach(function (photo) {
      [photo && photo.full, photo && photo.grid].forEach(function (path) {
        if (typeof path !== "string" || path.includes("\\") ||
            path.split("/").some(function (part) { return !part || part === "." || part === ".."; })) {
          throw new Error("Invalid photo path");
        }
      });
    });
    return data;
  }

  /* ---------- Login and gallery rendering ---------- */
  function initLogin() {
    var form = $("#loginForm"), btn = $("#loginBtn"), errBox = $("#loginError");
    $("#fillDemo").addEventListener("click", function () {
      $("#g-email").value = "demo@oj-oyesola.com";
      $("#g-code").value = "OJ-DEMO";
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (btn.disabled) return;
      errBox.classList.remove("is-visible");
      var email = $("#g-email"), code = $("#g-code");
      email.value = email.value.trim().toLowerCase();
      code.value = code.value.trim().toUpperCase();
      if (!form.reportValidity()) return;
      if (!window.crypto || !window.crypto.subtle) {
        $("#loginErrorMsg").textContent = "This page needs HTTPS. Please open it from the official website.";
        errBox.classList.add("is-visible");
        return;
      }
      btn.disabled = true;
      btn.textContent = "Opening…";
      var notFound = false;
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 15000);
      try {
        var base = "galleries/" + await galleryHash(email.value, code.value);
        var response = await fetch(base + "/data.json", { cache: "no-store", signal: controller.signal });
        notFound = response.status === 404;
        if (!response.ok) throw new Error("Gallery request failed");
        var data = validateGallery(await response.json());
        state.data = data;
        state.base = base;
        openGallery();
      } catch (err) {
        $("#loginErrorMsg").textContent = notFound
          ? "We couldn't find a gallery with that email and code. Double-check both, or contact us to resend it."
          : "Your gallery couldn't be opened right now. Please check your connection and try again, or contact us.";
        errBox.classList.add("is-visible");
      } finally {
        clearTimeout(timeout);
        btn.disabled = false;
        btn.textContent = "Access My Gallery";
      }
    });
  }

  function openGallery() {
    var data = state.data;
    state.expired = !!data.expires && Date.now() > new Date(data.expires + "T23:59:59.999Z").getTime();
    $("#gTitle").textContent = data.title || "Your Gallery";
    $("#gSubtitle").textContent = data.subtitle || "";
    $("#gSubtitle").hidden = !data.subtitle;
    $("#gDate").textContent = data.date || "";
    $("#gDate").hidden = !data.date;
    $("#gCount").textContent = data.photos.length + (data.photos.length === 1 ? " photo" : " photos");
    $("#gCount").hidden = !!data.externalUrl || state.expired;
    $("#expiredBanner").hidden = !state.expired;
    $("#externalWrap").hidden = !data.externalUrl || state.expired;
    if (data.externalUrl && !state.expired) $("#externalLink").href = data.externalUrl;
    else $("#externalLink").removeAttribute("href");
    $("#photoGrid").hidden = !photos().length;
    $("#downloadStatus").textContent = "";

    var fragment = document.createDocumentFragment();
    photos().forEach(function (photo, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "photo-cell";
      cell.dataset.index = i;
      cell.setAttribute("aria-label", "View photo " + (i + 1));
      var img = document.createElement("img");
      img.alt = "Photo " + (i + 1);
      img.loading = "lazy";
      img.decoding = "async";
      if (photo.w > 0 && photo.h > 0) { img.width = photo.w; img.height = photo.h; }
      img.src = photoUrl(photo.grid);
      // Only constant markup is parsed; gallery data is assigned via DOM properties.
      cell.innerHTML = '<span class="check" aria-hidden="true">✓</span><span class="num">' + String(i + 1).padStart(2, "0") + "</span>";
      cell.prepend(img);
      fragment.appendChild(cell);
    });
    $("#photoGrid").replaceChildren(fragment);
    syncBar();
    $("#loginView").hidden = true;
    $("#galleryView").classList.add("is-active");
    window.scrollTo(0, 0);
    $("#gTitle").focus({ preventScroll: true });
  }

  function signOut() {
    $("#photoLightbox").close();
    state.lbIndex = -1;
    if (state.download) {
      state.download.controller.abort();
      finishDownload(state.download);
    }
    state.data = null;
    state.base = "";
    state.expired = false;
    state.selected.clear();
    state.selectMode = false;
    $("#photoGrid").replaceChildren();
    $("#plImg").removeAttribute("src");
    $("#plDownload").removeAttribute("href");
    $("#externalLink").removeAttribute("href");
    $("#galleryView").classList.remove("is-active");
    $("#loginView").hidden = false;
    $("#loginForm").reset();
    syncBar();
    window.scrollTo(0, 0);
    $("#g-email").focus({ preventScroll: true });
  }

  /* ---------- Selection ---------- */
  function syncBar() {
    var n = state.selected.size, available = photos().length;
    var visible = available > 0 && (n > 0 || state.selectMode);
    $("#abCount").textContent = n + " selected";
    $("#abSelectAll").textContent = n === available && n > 0 ? "Deselect all" : "Select all";
    $("#actionBar").classList.toggle("is-visible", visible);
    $("#actionBar").inert = !visible;
    $("#actionBar").setAttribute("aria-hidden", String(!visible));
    document.body.classList.toggle("select-mode", state.selectMode);
    $("#gTools").hidden = !available;
    $("#btnSelectMode").classList.toggle("is-active", state.selectMode);
    $("#btnSelectMode").setAttribute("aria-pressed", String(state.selectMode));
    $("#selectModeLabel").textContent = state.selectMode ? "Done selecting" : "Select photos";
    $("#btnDownloadAll").disabled = !available || !!state.download;
    $("#abDownload").disabled = !n || !!state.download;
    $("#abClear").disabled = !n;
    if (state.lbIndex >= 0) {
      var selected = state.selected.has(state.lbIndex);
      $("#plSelect").textContent = selected ? "Selected ✓" : "Select photo";
      $("#plSelect").setAttribute("aria-pressed", String(selected));
      $("#plSelect").classList.toggle("btn--brass", !selected);
    }
  }
  function syncSelection() {
    Array.from($("#photoGrid").children).forEach(function (cell, i) {
      cell.classList.toggle("is-selected", state.selected.has(i));
      cell.setAttribute("aria-label", (state.selectMode ? "Select photo " : "View photo ") + (i + 1));
      if (state.selectMode) cell.setAttribute("aria-pressed", String(state.selected.has(i)));
      else cell.removeAttribute("aria-pressed");
    });
    syncBar();
  }
  function toggleSelect(i) {
    if (!photos()[i]) return;
    if (state.selected.has(i)) state.selected.delete(i);
    else state.selected.add(i);
    syncSelection();
  }

  /* ---------- Downloads: load ZIP support only when needed ---------- */
  function zipLibrary() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    if (!zipPromise) zipPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      var timeout = setTimeout(failed, 8000);
      function failed() {
        clearTimeout(timeout);
        script.remove();
        reject(new Error("ZIP library unavailable"));
      }
      script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
      script.integrity = "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG";
      script.crossOrigin = "anonymous";
      script.onload = function () {
        if (!window.JSZip) { failed(); return; }
        clearTimeout(timeout);
        resolve(window.JSZip);
      };
      script.onerror = failed;
      document.head.appendChild(script);
    }).catch(function (err) { zipPromise = null; throw err; });
    return zipPromise;
  }
  function saveFile(url, name) {
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function finishDownload(job) {
    if (state.download !== job) return;
    job.btn.innerHTML = job.label;
    job.btn.removeAttribute("aria-busy");
    state.download = null;
    syncBar();
  }
  async function downloadIndices(indices, btn) {
    if (state.download) return;
    var available = photos();
    // Snapshot URLs and names so signing into another gallery cannot mix deliveries.
    var files = indices.filter(function (i) { return !!available[i]; }).map(function (i) {
      return { url: photoUrl(available[i].full), name: photoName(i) };
    });
    if (!files.length) return;
    $("#downloadStatus").textContent = "";
    if (files.length === 1) { saveFile(files[0].url, files[0].name); return; }
    var title = slugTitle();
    var job = { controller: new AbortController(), btn: btn, label: btn.innerHTML };
    var signal = job.controller.signal;
    state.download = job;
    btn.setAttribute("aria-busy", "true");
    syncBar();
    function busy(text) { if (state.download === job) btn.textContent = text; }
    busy("Preparing…");
    try {
      var Zip;
      try { Zip = await zipLibrary(); }
      catch (err) {
        if (signal.aborted) return;
        $("#downloadStatus").textContent = "ZIP support is unavailable. Downloading individually — allow multiple downloads if your browser asks.";
        for (var f = 0; f < files.length; f++) {
          if (f) await new Promise(function (resolve) { setTimeout(resolve, 380); });
          if (signal.aborted) return;
          saveFile(files[f].url, files[f].name);
        }
        return;
      }
      if (signal.aborted) return;
      var zip = new Zip(), next = 0, completed = 0;
      async function worker() {
        while (next < files.length && !signal.aborted) {
          var file = files[next++];
          var response = await fetch(file.url, { signal: signal });
          if (!response.ok) throw new Error("Photo request failed");
          zip.file(file.name, await response.blob());
          busy("Downloading " + (++completed) + "/" + files.length + "…");
        }
      }
      // Bounded parallel fetches are faster than a serial chain without a request flood.
      await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
      if (signal.aborted) return;
      var blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, function (meta) {
        if (signal.aborted) throw new Error("Download cancelled");
        busy("Packing " + Math.round(meta.percent) + "%");
      });
      if (signal.aborted) return;
      var url = URL.createObjectURL(blob);
      saveFile(url, title + ".zip");
      setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    } catch (err) {
      if (!signal.aborted) {
        $("#downloadStatus").textContent = "The download was interrupted. Please check your connection and try again.";
        job.controller.abort();
      }
    } finally {
      finishDownload(job);
    }
  }

  /* ---------- Prints and lightbox ---------- */
  function requestPrints() {
    if (!photos().length) return;
    var picks = Array.from(state.selected).sort(function (a, b) { return a - b; });
    var list = picks.length ? picks.map(function (i) { return "Photo " + String(i + 1).padStart(2, "0"); }).join(", ") : "All photos";
    var subject = "Print Order — " + (state.data.title || "Gallery");
    var body = 'Hello OJ,\n\nI\'d like to order prints from "' + (state.data.title || "my gallery") + '".\n\nPhotos: ' + list +
      "\n\nSizes / finishes I'm interested in:\n\nDelivery address:\n";
    window.location.href = "mailto:" + (CFG.email || "oj.oyesola@gmail.com") +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }
  function openLightbox(i) {
    if (!photos()[i]) return;
    state.lbIndex = i;
    renderLB();
    $("#photoLightbox").showModal();
  }
  function renderLB() {
    var photo = photos()[state.lbIndex];
    if (!photo) return;
    $("#plImg").src = photoUrl(photo.full);
    $("#plImg").alt = "Photo " + (state.lbIndex + 1);
    $("#plCount").textContent = String(state.lbIndex + 1).padStart(2, "0") + " / " + String(photos().length).padStart(2, "0");
    $("#plTitle").textContent = photo.caption || state.data.title || "";
    $("#plCat").textContent = state.data.subtitle || "";
    $("#plDownload").href = photoUrl(photo.full);
    $("#plDownload").download = photoName(state.lbIndex);
    syncBar();
  }
  function moveLB(dir) {
    var n = photos().length;
    if (!n) return;
    state.lbIndex = (state.lbIndex + dir + n) % n;
    renderLB();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLogin();
    $("#signOut").addEventListener("click", signOut);
    $("#photoGrid").addEventListener("click", function (e) {
      var cell = e.target.closest("[data-index]");
      if (!cell) return;
      var index = Number(cell.dataset.index);
      if (state.selectMode) toggleSelect(index);
      else openLightbox(index);
    });
    $("#btnSelectMode").addEventListener("click", function () {
      state.selectMode = !state.selectMode;
      if (!state.selectMode) state.selected.clear();
      syncSelection();
    });
    $("#btnDownloadAll").addEventListener("click", function () {
      downloadIndices(photos().map(function (_, i) { return i; }), this);
    });
    $("#btnPrints").addEventListener("click", requestPrints);
    $("#abSelectAll").addEventListener("click", function () {
      var all = state.selected.size === photos().length;
      state.selected.clear();
      if (!all) photos().forEach(function (_, i) { state.selected.add(i); });
      syncSelection();
    });
    $("#abClear").addEventListener("click", function () { state.selected.clear(); syncSelection(); });
    $("#abDownload").addEventListener("click", function () {
      downloadIndices(Array.from(state.selected).sort(function (a, b) { return a - b; }), this);
    });
    var lightbox = $("#photoLightbox");
    $("#plClose").addEventListener("click", function () { lightbox.close(); });
    $("#plPrev").addEventListener("click", function () { moveLB(-1); });
    $("#plNext").addEventListener("click", function () { moveLB(1); });
    $("#plSelect").addEventListener("click", function () {
      state.selectMode = true;
      toggleSelect(state.lbIndex);
    });
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) lightbox.close(); });
    lightbox.addEventListener("close", function () {
      if (lightbox.open) return;
      state.lbIndex = -1;
      $("#plImg").removeAttribute("src");
      $("#plDownload").removeAttribute("href");
    });
    lightbox.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault(); moveLB(e.key === "ArrowLeft" ? -1 : 1);
      }
    });
    syncBar();
  });
})();
