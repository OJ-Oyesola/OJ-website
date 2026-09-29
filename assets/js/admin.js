(function () {
  "use strict";

  var CFG = window.OJ_CONFIG || {};
  var STORAGE_API_BASE = "oj_admin_api_base";
  var STORAGE_ADMIN_TOKEN = "oj_admin_api_token";
  var state = {
    apiBase: "",
    adminToken: "",
    discoveredApiBase: "",
    scanned: null,
    galleries: []
  };

  function $(selector) { return document.querySelector(selector); }
  function normalizeBase(value) { return String(value || "").trim().replace(/\/+$/, ""); }
  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "client-gallery";
  }
  function isHash(value) {
    return /^[a-f0-9]{64}$/i.test(String(value || ""));
  }
  function photoKey(index) {
    return "photo-" + String(index + 1).padStart(3, "0");
  }
  function setStatus(selector, message, tone) {
    var el = $(selector);
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("is-error", tone === "error");
    el.classList.toggle("is-success", tone === "success");
  }
  function appendLog(message) {
    var log = $("#importLog");
    if (!log) return;
    if (!log.dataset.hasContent) {
      log.textContent = "";
      log.dataset.hasContent = "true";
    }
    log.textContent += (log.textContent ? "\n" : "") + message;
    log.scrollTop = log.scrollHeight;
  }
  function saveCredentials() {
    localStorage.setItem(STORAGE_API_BASE, state.apiBase);
    localStorage.setItem(STORAGE_ADMIN_TOKEN, state.adminToken);
  }
  function loadSavedCredentials() {
    state.apiBase = normalizeBase(localStorage.getItem(STORAGE_API_BASE) || "");
    state.adminToken = String(localStorage.getItem(STORAGE_ADMIN_TOKEN) || "").trim();
  }
  async function discoverApiBase() {
    var configured = normalizeBase(CFG.clientApiBase || "");
    if (configured) return configured;
    try {
      var response = await fetch("cloudflare/resources.json", { cache: "no-store" });
      if (!response.ok) return "";
      var manifest = await response.json();
      return normalizeBase(manifest && manifest.worker && (manifest.worker.url || manifest.worker.workers_dev_url) || "");
    } catch (error) {
      return "";
    }
  }
  function apiFetch(pathname, init) {
    if (!state.apiBase) return Promise.reject(new Error("Worker API base URL is required."));
    if (!state.adminToken) return Promise.reject(new Error("Admin API token is required."));
    var headers = new Headers(init && init.headers || {});
    headers.set("authorization", "Bearer " + state.adminToken);
    return fetch(state.apiBase + pathname, Object.assign({}, init || {}, { headers: headers }))
      .then(async function (response) {
        var text = await response.text();
        var payload;
        try { payload = text ? JSON.parse(text) : null; }
        catch (error) { payload = text; }
        if (!response.ok) {
          var detail = payload && typeof payload === "object" ? (payload.error || payload.detail || JSON.stringify(payload)) : String(payload || response.statusText);
          throw new Error(detail);
        }
        return payload;
      });
  }
  function renderGalleries() {
    var body = $("#galleryRows");
    if (!body) return;
    if (!state.galleries.length) {
      body.innerHTML = '<tr><td colspan="6">No backend galleries found yet.</td></tr>';
      return;
    }
    body.innerHTML = state.galleries.map(function (gallery) {
      return "<tr>" +
        "<td>" + escapeHtml(gallery.title || "") + "</td>" +
        "<td><code>" + escapeHtml(gallery.slug || "") + "</code></td>" +
        "<td>" + escapeHtml(gallery.kind || "") + "</td>" +
        "<td>" + escapeHtml(gallery.visibility || "") + "</td>" +
        "<td>" + escapeHtml(String(gallery.photoCount || 0)) + "</td>" +
        "<td>" + escapeHtml(gallery.updatedAt || gallery.createdAt || "") + "</td>" +
      "</tr>";
    }).join("");
  }
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  async function loadGalleries() {
    setStatus("#connectStatus", "Loading backend galleries…");
    var payload = await apiFetch("/api/admin/galleries");
    state.galleries = payload && payload.galleries || [];
    renderGalleries();
    setStatus("#connectStatus", "Connected. Gallery list loaded.", "success");
  }
  async function handleConnect(event) {
    event.preventDefault();
    state.apiBase = normalizeBase($("#apiBase").value);
    state.adminToken = String($("#adminToken").value || "").trim();
    saveCredentials();
    try {
      await loadGalleries();
    } catch (error) {
      setStatus("#connectStatus", error.message || "Connection failed.", "error");
      appendLog("Connection failed: " + (error.message || error));
    }
  }
  function readSelectedFiles() {
    return Array.from($("#galleryFolder").files || []);
  }
  async function scanFolder() {
    var files = readSelectedFiles();
    if (!files.length) throw new Error("Choose a single galleries/<hash>/ folder first.");
    var dataFile = files.find(function (file) {
      return /(^|\/)data\.json$/i.test(file.webkitRelativePath || file.name);
    });
    if (!dataFile) throw new Error("The selected folder does not contain data.json.");
    var relativeRoot = (dataFile.webkitRelativePath || dataFile.name).split("/")[0];
    if (!isHash(relativeRoot)) throw new Error("The selected folder name must be the 64-character gallery hash.");
    var manifest = JSON.parse(await dataFile.text());
    var fileMap = new Map();
    files.forEach(function (file) {
      var parts = String(file.webkitRelativePath || file.name).split("/");
      parts.shift();
      fileMap.set(parts.join("/"), file);
    });
    var uploads = [];
    (manifest.photos || []).forEach(function (photo, index) {
      [
        { variant: "grid", relativePath: photo.grid, setAsCover: index === 0 },
        { variant: "original", relativePath: photo.full, setAsCover: false },
        { variant: "thumb", relativePath: photo.thumb, setAsCover: false }
      ].forEach(function (item) {
        var file = fileMap.get(item.relativePath);
        if (!file) throw new Error("Missing file referenced in data.json: " + item.relativePath);
        uploads.push({
          file: file,
          variant: item.variant,
          relativePath: item.relativePath,
          setAsCover: item.setAsCover,
          position: index,
          width: Number(photo.w || 0),
          height: Number(photo.h || 0),
          title: photoKey(index),
          altText: (manifest.title || "Client gallery") + " — Photo " + String(index + 1).padStart(3, "0")
        });
      });
    });
    var slug = slugify(manifest.title) + "-" + relativeRoot.slice(0, 8);
    state.scanned = {
      hash: relativeRoot.toLowerCase(),
      slug: slug,
      title: String(manifest.title || slug).trim(),
      subtitle: String(manifest.subtitle || "").trim(),
      category: String(manifest.date || "").trim(),
      expiresAt: String(manifest.expires || "").trim(),
      photoCount: Array.isArray(manifest.photos) ? manifest.photos.length : 0,
      uploads: uploads
    };
    $("#previewHash").textContent = state.scanned.hash;
    $("#previewSlug").textContent = state.scanned.slug;
    $("#previewTitle").textContent = state.scanned.title;
    $("#previewPhotoCount").textContent = String(state.scanned.photoCount);
    $("#previewUploadCount").textContent = String(state.scanned.uploads.length);
    $("#importPreview").hidden = false;
    setStatus("#importStatus", "Gallery folder scanned successfully.", "success");
    appendLog("Scanned " + state.scanned.slug + " with " + state.scanned.uploads.length + " uploads ready.");
  }
  async function uploadVariant(slug, upload, visibility) {
    var form = new FormData();
    form.set("variant", upload.variant);
    form.set("title", upload.title);
    form.set("altText", upload.altText);
    form.set("position", String(upload.position));
    if (upload.width > 0) form.set("width", String(upload.width));
    if (upload.height > 0) form.set("height", String(upload.height));
    form.set("isPublic", visibility === "public" ? "1" : "0");
    if (upload.setAsCover) form.set("setAsCover", "1");
    form.append("file", upload.file, upload.file.name);
    return apiFetch("/api/admin/galleries/" + encodeURIComponent(slug) + "/uploads", { method: "POST", body: form });
  }
  async function handleImport(event) {
    event.preventDefault();
    if (!state.scanned) {
      try { await scanFolder(); }
      catch (error) {
        setStatus("#importStatus", error.message || "The folder could not be scanned.", "error");
        return;
      }
    }
    if (!state.apiBase || !state.adminToken) {
      setStatus("#importStatus", "Connect to the Worker first.", "error");
      return;
    }
    var visibility = $("#galleryVisibility").value;
    var payload = {
      kind: "client",
      slug: state.scanned.slug,
      title: state.scanned.title,
      subtitle: state.scanned.subtitle,
      category: state.scanned.category,
      visibility: visibility,
      accessCodeHash: state.scanned.hash,
      expiresAt: state.scanned.expiresAt
    };
    setStatus("#importStatus", "Creating backend gallery…");
    appendLog("Creating backend gallery " + state.scanned.slug + "…");
    try {
      await apiFetch("/api/admin/galleries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      for (var index = 0; index < state.scanned.uploads.length; index += 1) {
        var upload = state.scanned.uploads[index];
        appendLog("Uploading " + upload.variant + " → " + upload.relativePath);
        setStatus("#importStatus", "Uploading asset " + (index + 1) + " of " + state.scanned.uploads.length + "…");
        await uploadVariant(state.scanned.slug, upload, visibility);
      }
      appendLog("Import complete for " + state.scanned.slug + ".");
      setStatus("#importStatus", "Import complete.", "success");
      await loadGalleries();
    } catch (error) {
      appendLog("Import failed: " + (error.message || error));
      setStatus("#importStatus", error.message || "Import failed.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async function () {
    loadSavedCredentials();
    state.discoveredApiBase = await discoverApiBase();
    $("#apiBase").value = state.apiBase || state.discoveredApiBase || "";
    $("#adminToken").value = state.adminToken;
    if (state.discoveredApiBase) {
      setStatus("#connectStatus", "Discovered Worker URL: " + state.discoveredApiBase);
    } else {
      setStatus("#connectStatus", "No Worker URL discovered yet. Paste one manually if needed.");
    }
    $("#connectForm").addEventListener("submit", handleConnect);
    $("#useDiscoveredBtn").addEventListener("click", function () {
      if (!state.discoveredApiBase) {
        setStatus("#connectStatus", "No Worker URL has been discovered yet.", "error");
        return;
      }
      $("#apiBase").value = state.discoveredApiBase;
      setStatus("#connectStatus", "Discovered Worker URL inserted. Add your admin token and connect.", "success");
    });
    $("#scanFolderBtn").addEventListener("click", async function () {
      try { await scanFolder(); }
      catch (error) {
        setStatus("#importStatus", error.message || "The folder could not be scanned.", "error");
        appendLog("Scan failed: " + (error.message || error));
      }
    });
    $("#importForm").addEventListener("submit", handleImport);
    $("#refreshGalleriesBtn").addEventListener("click", async function () {
      try { await loadGalleries(); }
      catch (error) {
        setStatus("#connectStatus", error.message || "Could not refresh galleries.", "error");
      }
    });
  });
})();
