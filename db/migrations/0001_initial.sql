PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'portfolio' CHECK (kind IN ('portfolio', 'client')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'draft' CHECK (visibility IN ('draft', 'public', 'private', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  client_email TEXT NOT NULL DEFAULT '',
  access_code_hash TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  cover_object_key TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS galleries_kind_visibility_sort_idx
  ON galleries (kind, visibility, sort_order, created_at DESC);

CREATE TABLE IF NOT EXISTS media_objects (
  id TEXT PRIMARY KEY,
  gallery_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  variant TEXT NOT NULL DEFAULT 'original' CHECK (variant IN ('original', 'grid', 'thumb')),
  title TEXT NOT NULL DEFAULT '',
  alt_text TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (gallery_id) REFERENCES galleries(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS media_objects_gallery_position_idx
  ON media_objects (gallery_id, position, created_at);

CREATE INDEX IF NOT EXISTS media_objects_public_idx
  ON media_objects (is_public, gallery_id);
