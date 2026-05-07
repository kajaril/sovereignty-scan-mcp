-- ============================================================================
-- sovereignty_db_paid — proprietary risk scores (Week 5–7 build)
-- Schema reference only. NOT applied to free DB.
-- The free-tier worker has NO binding to this database.
-- Per decision #1: database split is architectural, not code-discipline.
-- ============================================================================

CREATE TABLE IF NOT EXISTS provider_risk_scores (
  provider_id TEXT PRIMARY KEY,         -- references providers.id in free DB by convention; cross-DB FK not enforced
  sovereignty_risk_score INTEGER NOT NULL CHECK(sovereignty_risk_score >= 1 AND sovereignty_risk_score <= 5),
  remediation_guidance TEXT,
  scored_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
