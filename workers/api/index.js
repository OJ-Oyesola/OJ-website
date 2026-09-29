function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  };
}

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  Object.entries(corsHeaders()).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

function text(message, init = {}) {
  const headers = new Headers(init.headers || {});
  Object.entries(corsHeaders()).forEach(([key, value]) => headers.set(key, value));
  return new Response(message, { ...init, headers });
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function mediaUrl(request, objectKey) {
  return new URL("/media/" + objectKey.split("/").map(encodeURIComponent).join("/"), request.url).toString();
}

function requireDb(env) {
  if (!env.DB) throw new HttpError(503, "D1 binding is not configured.");
}

function requireMedia(env) {
  if (!env.MEDIA) throw new HttpError(503, "R2 binding is not configured.");
}

function requireAdmin(request, env) {
  const configured = env.ADMIN_API_TOKEN;
  if (!configured) throw new HttpError(503, "Admin API token is not configured.");
  const header = request.headers.get("authorization") || "";
  if (header !== "Bearer " + configured) throw new HttpError(401, "Unauthorized.");
}

async function getGalleryBySlug(env, slug) {
  const row = await env.DB.prepare(
    `SELECT id, kind, slug, title, subtitle, category, description, visibility,
            sort_order AS sortOrder, client_email AS clientEmail, access_code_hash AS accessCodeHash,
            external_url AS externalUrl, cover_object_key AS coverObjectKey, expires_at AS expiresAt,
            created_at AS createdAt, updated_at AS updatedAt
       FROM galleries WHERE slug = ?1`
  ).bind(slug).first();
  return row || null;
}

async function listPublicGalleries(request, env) {
  requireDb(env);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") || "portfolio";
  const { results } = await env.DB.prepare(
    `SELECT id, kind, slug, title, subtitle, category, description, visibility,
            sort_order AS sortOrder, external_url AS externalUrl, cover_object_key AS coverObjectKey,
            expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt
       FROM galleries
      WHERE visibility = 'public' AND kind = ?1
      ORDER BY sort_order ASC, created_at DESC`
  ).bind(kind).all();
  return json({
    ok: true,
    galleries: (results || []).map((gallery) => ({
      ...gallery,
      coverUrl: gallery.coverObjectKey ? mediaUrl(request, gallery.coverObjectKey) : ""
    }))
  });
}

async function getPublicGallery(request, env, slug) {
  requireDb(env);
  const gallery = await env.DB.prepare(
    `SELECT id, kind, slug, title, subtitle, category, description, visibility,
            sort_order AS sortOrder, external_url AS externalUrl, cover_object_key AS coverObjectKey,
            expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt
       FROM galleries
      WHERE slug = ?1 AND visibility = 'public'`
  ).bind(slug).first();
  if (!gallery) throw new HttpError(404, "Gallery not found.");
  const { results } = await env.DB.prepare(
    `SELECT id, object_key AS objectKey, variant, title, alt_text AS altText, mime_type AS mimeType,
            bytes, width, height, position, created_at AS createdAt
       FROM media_objects
      WHERE gallery_id = ?1 AND is_public = 1
      ORDER BY position ASC, created_at ASC`
  ).bind(gallery.id).all();
  return json({
    ok: true,
    gallery: {
      ...gallery,
      coverUrl: gallery.coverObjectKey ? mediaUrl(request, gallery.coverObjectKey) : "",
      photos: (results || []).map((photo) => ({ ...photo, url: mediaUrl(request, photo.objectKey) }))
    }
  });
}

async function listAdminGalleries(request, env) {
  requireAdmin(request, env);
  requireDb(env);
  const { results } = await env.DB.prepare(
    `SELECT g.id, g.kind, g.slug, g.title, g.subtitle, g.category, g.description, g.visibility,
            g.sort_order AS sortOrder, g.client_email AS clientEmail, g.external_url AS externalUrl,
            g.cover_object_key AS coverObjectKey, g.expires_at AS expiresAt, g.created_at AS createdAt,
            g.updated_at AS updatedAt,
            COUNT(m.id) AS photoCount
       FROM galleries g
       LEFT JOIN media_objects m ON m.gallery_id = g.id
      GROUP BY g.id
      ORDER BY g.updated_at DESC, g.created_at DESC`
  ).all();
  return json({ ok: true, galleries: results || [] });
}

async function createGallery(request, env) {
  requireAdmin(request, env);
  requireDb(env);
  const body = await request.json();
  if (!body || !body.title) throw new HttpError(400, "title is required.");
  const slug = slugify(body.slug || body.title);
  if (await getGalleryBySlug(env, slug)) throw new HttpError(409, "A gallery with that slug already exists.");
  const id = crypto.randomUUID();
  const timestamp = nowIso();
  const record = {
    id,
    kind: body.kind === "client" ? "client" : "portfolio",
    slug,
    title: String(body.title).trim(),
    subtitle: String(body.subtitle || "").trim(),
    category: String(body.category || "").trim(),
    description: String(body.description || "").trim(),
    visibility: body.visibility || (body.kind === "client" ? "private" : "draft"),
    sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    clientEmail: String(body.clientEmail || "").trim().toLowerCase(),
    accessCodeHash: String(body.accessCodeHash || "").trim(),
    externalUrl: String(body.externalUrl || "").trim(),
    coverObjectKey: "",
    expiresAt: String(body.expiresAt || "").trim(),
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await env.DB.prepare(
    `INSERT INTO galleries (
      id, kind, slug, title, subtitle, category, description, visibility, sort_order,
      client_email, access_code_hash, external_url, cover_object_key, expires_at, created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
  ).bind(
    record.id, record.kind, record.slug, record.title, record.subtitle, record.category,
    record.description, record.visibility, record.sortOrder, record.clientEmail,
    record.accessCodeHash, record.externalUrl, record.coverObjectKey, record.expiresAt,
    record.createdAt, record.updatedAt
  ).run();
  return json({ ok: true, gallery: record }, { status: 201 });
}

async function updateGallery(request, env, slug) {
  requireAdmin(request, env);
  requireDb(env);
  const current = await getGalleryBySlug(env, slug);
  if (!current) throw new HttpError(404, "Gallery not found.");
  const body = await request.json();
  const updated = {
    title: body.title === undefined ? current.title : String(body.title).trim(),
    subtitle: body.subtitle === undefined ? current.subtitle : String(body.subtitle || "").trim(),
    category: body.category === undefined ? current.category : String(body.category || "").trim(),
    description: body.description === undefined ? current.description : String(body.description || "").trim(),
    visibility: body.visibility || current.visibility,
    sortOrder: body.sortOrder === undefined ? current.sortOrder : Number(body.sortOrder),
    clientEmail: body.clientEmail === undefined ? current.clientEmail : String(body.clientEmail || "").trim().toLowerCase(),
    accessCodeHash: body.accessCodeHash === undefined ? current.accessCodeHash : String(body.accessCodeHash || "").trim(),
    externalUrl: body.externalUrl === undefined ? current.externalUrl : String(body.externalUrl || "").trim(),
    coverObjectKey: body.coverObjectKey === undefined ? current.coverObjectKey : String(body.coverObjectKey || "").trim(),
    expiresAt: body.expiresAt === undefined ? current.expiresAt : String(body.expiresAt || "").trim(),
    updatedAt: nowIso()
  };
  await env.DB.prepare(
    `UPDATE galleries
        SET title = ?2, subtitle = ?3, category = ?4, description = ?5, visibility = ?6,
            sort_order = ?7, client_email = ?8, access_code_hash = ?9, external_url = ?10,
            cover_object_key = ?11, expires_at = ?12, updated_at = ?13
      WHERE slug = ?1`
  ).bind(
    slug, updated.title, updated.subtitle, updated.category, updated.description,
    updated.visibility, updated.sortOrder, updated.clientEmail, updated.accessCodeHash,
    updated.externalUrl, updated.coverObjectKey, updated.expiresAt, updated.updatedAt
  ).run();
  return json({ ok: true, gallery: { ...current, ...updated, slug } });
}

function sanitizeFilename(name) {
  const parts = String(name || "upload").split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
  const base = parts.join(".").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
  return { base, ext: ext || "bin" };
}

async function uploadMedia(request, env, slug) {
  requireAdmin(request, env);
  requireDb(env);
  requireMedia(env);
  const gallery = await getGalleryBySlug(env, slug);
  if (!gallery) throw new HttpError(404, "Gallery not found.");
  const form = await request.formData();
  const files = [];
  form.getAll("file").forEach((value) => files.push(value));
  form.getAll("files").forEach((value) => files.push(value));
  const uploads = files.filter((value) => value && typeof value.stream === "function");
  if (!uploads.length) throw new HttpError(400, "Attach at least one file as form-data using file or files.");

  const nextPositionRow = await env.DB.prepare(
    `SELECT COALESCE(MAX(position), -1) AS maxPosition FROM media_objects WHERE gallery_id = ?1`
  ).bind(gallery.id).first();
  let nextPosition = (nextPositionRow && Number(nextPositionRow.maxPosition)) + 1;
  const saved = [];

  for (const file of uploads) {
    const cleaned = sanitizeFilename(file.name);
    const objectKey = `${gallery.kind}/${gallery.slug}/${crypto.randomUUID()}-${cleaned.base}.${cleaned.ext}`;
    await env.MEDIA.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" }
    });
    const record = {
      id: crypto.randomUUID(),
      galleryId: gallery.id,
      objectKey,
      variant: String(form.get("variant") || "original"),
      title: String(form.get("title") || "").trim(),
      altText: String(form.get("altText") || file.name || gallery.title).trim(),
      mimeType: file.type || "application/octet-stream",
      bytes: Number(file.size || 0),
      width: null,
      height: null,
      position: nextPosition++,
      isPublic: gallery.visibility === "public" ? 1 : 0,
      createdAt: nowIso(),
      originalFilename: file.name || ""
    };
    await env.DB.prepare(
      `INSERT INTO media_objects (
        id, gallery_id, object_key, variant, title, alt_text, mime_type, bytes,
        width, height, position, is_public, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
    ).bind(
      record.id, record.galleryId, record.objectKey, record.variant, record.title,
      record.altText, record.mimeType, record.bytes, record.width, record.height,
      record.position, record.isPublic, record.createdAt
    ).run();
    if (!gallery.coverObjectKey) {
      await env.DB.prepare(
        `UPDATE galleries SET cover_object_key = ?2, updated_at = ?3 WHERE id = ?1`
      ).bind(gallery.id, objectKey, nowIso()).run();
      gallery.coverObjectKey = objectKey;
    }
    saved.push({
      id: record.id,
      objectKey: record.objectKey,
      mimeType: record.mimeType,
      bytes: record.bytes,
      position: record.position,
      url: mediaUrl(request, record.objectKey),
      originalFilename: record.originalFilename
    });
  }

  return json({ ok: true, uploaded: saved }, { status: 201 });
}

async function serveMedia(request, env, objectKey) {
  requireDb(env);
  requireMedia(env);
  const normalized = objectKey.split("/").filter(Boolean).join("/");
  if (!normalized || normalized.includes("..")) throw new HttpError(400, "Invalid object key.");
  const allowed = await env.DB.prepare(
    `SELECT m.object_key AS objectKey, m.mime_type AS mimeType
       FROM media_objects m
       INNER JOIN galleries g ON g.id = m.gallery_id
      WHERE m.object_key = ?1 AND m.is_public = 1 AND g.visibility = 'public'`
  ).bind(normalized).first();
  if (!allowed) throw new HttpError(404, "File not found.");
  const object = await env.MEDIA.get(normalized);
  if (!object) throw new HttpError(404, "File not found.");
  const headers = new Headers();
  Object.entries(corsHeaders()).forEach(([key, value]) => headers.set(key, value));
  headers.set("content-type", object.httpMetadata?.contentType || allowed.mimeType || "application/octet-stream");
  headers.set("cache-control", "public, max-age=3600");
  headers.set("etag", object.httpEtag || object.etag || "");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          ok: true,
          service: "oj-website-api",
          version: env.API_VERSION || "2026-09-29",
          r2Bound: Boolean(env.MEDIA),
          d1Bound: Boolean(env.DB),
          adminConfigured: Boolean(env.ADMIN_API_TOKEN),
          timestamp: nowIso()
        });
      }
      if (request.method === "GET" && url.pathname === "/api/public/galleries") {
        return await listPublicGalleries(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/public/galleries/")) {
        const slug = decodeURIComponent(url.pathname.slice("/api/public/galleries/".length));
        return await getPublicGallery(request, env, slug);
      }
      if (request.method === "GET" && url.pathname === "/api/admin/galleries") {
        return await listAdminGalleries(request, env);
      }
      if (request.method === "POST" && url.pathname === "/api/admin/galleries") {
        return await createGallery(request, env);
      }
      if (request.method === "PATCH" && url.pathname.startsWith("/api/admin/galleries/")) {
        const slug = decodeURIComponent(url.pathname.slice("/api/admin/galleries/".length));
        return await updateGallery(request, env, slug);
      }
      if (request.method === "POST" && url.pathname.startsWith("/api/admin/galleries/") && url.pathname.endsWith("/uploads")) {
        const slug = decodeURIComponent(url.pathname.slice("/api/admin/galleries/".length, -"/uploads".length));
        return await uploadMedia(request, env, slug);
      }
      if (request.method === "GET" && url.pathname.startsWith("/media/")) {
        const objectKey = decodeURIComponent(url.pathname.slice("/media/".length));
        return await serveMedia(request, env, objectKey);
      }
      return text("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof HttpError) return json({ ok: false, error: error.message }, { status: error.status });
      return json({ ok: false, error: "Internal error", detail: String(error && error.message || error) }, { status: 500 });
    }
  }
};
