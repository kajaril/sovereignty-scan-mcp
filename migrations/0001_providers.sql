-- ============================================================================
-- sovereignty_db_free — public-readable provider facts
-- Free-tier worker binding only. No binding to sovereignty_db_paid.
-- Architectural isolation per decision #1.
-- ============================================================================

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  hq_country TEXT NOT NULL,
  data_residency_regions TEXT NOT NULL, -- JSON array stored as TEXT
  eu_residency_option INTEGER NOT NULL DEFAULT 0,
  us_cloud_act_subject INTEGER NOT NULL DEFAULT 0,
  gdpr_dpa_available INTEGER NOT NULL DEFAULT 0,
  legal_framework TEXT,                 -- e.g. "GDPR", "US-CLOUD-Act", "GDPR+SCC"
  last_verified_at TEXT NOT NULL,       -- ISO 8601
  verification_source TEXT NOT NULL,    -- manual | official-docs | stripe-projects | cf-changelog
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category ON providers(category);
CREATE INDEX IF NOT EXISTS idx_eu_option ON providers(eu_residency_option);
CREATE INDEX IF NOT EXISTS idx_cloud_act ON providers(us_cloud_act_subject);

CREATE TABLE IF NOT EXISTS cache_metadata (
  key TEXT PRIMARY KEY,
  last_refreshed_at TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL DEFAULT 604800
);
