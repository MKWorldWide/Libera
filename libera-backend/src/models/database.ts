import { Pool } from 'pg';
import { logger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Database configuration
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'libera_db',
  user: process.env.DB_USER || 'libera_user',
  password: process.env.DB_PASSWORD || 'libera_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database initialization function
export async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create tables
    await client.query(createTablesSQL);

    // Create indexes
    await client.query(createIndexesSQL);

    // Insert default rules
    await client.query(insertDefaultRulesSQL);

    logger.info('Database schema initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// SQL for creating tables
const createTablesSQL = `
-- Cases table
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  subject_id UUID NOT NULL,
  counsel_id UUID,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table (PII minimized with hashes)
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_hash VARCHAR(128) NOT NULL,
  contact_hash VARCHAR(128),
  consent_status VARCHAR(20) DEFAULT 'pending',
  consent_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (counsel, advocates, auditors)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  organization VARCHAR(255),
  license_number VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id),
  file_type VARCHAR(10) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  s3_path VARCHAR(500),
  file_hash VARCHAR(128) NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence items table
CREATE TABLE IF NOT EXISTS evidence_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES uploads(id),
  type VARCHAR(50) NOT NULL,
  extracted_text TEXT,
  timestamp TIMESTAMPTZ,
  location JSONB,
  owner_source VARCHAR(255),
  chain_of_custody_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rule definitions table
CREATE TABLE IF NOT EXISTS rule_defs (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  yaml_definition TEXT NOT NULL,
  owner VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rule definitions table
CREATE TABLE IF NOT EXISTS rule_defs (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  yaml_definition TEXT NOT NULL,
  owner VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table (immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100),
  details JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  signature VARCHAR(255)
);
`;

// SQL for creating indexes
const createIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_cases_subject_id ON cases(subject_id);
CREATE INDEX IF NOT EXISTS idx_cases_counsel_id ON cases(counsel_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at);

CREATE INDEX IF NOT EXISTS idx_subjects_name_hash ON subjects(name_hash);
CREATE INDEX IF NOT EXISTS idx_subjects_consent_status ON subjects(consent_status);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_uploads_case_id ON uploads(case_id);
CREATE INDEX IF NOT EXISTS idx_uploads_uploader_id ON uploads(uploader_id);

CREATE INDEX IF NOT EXISTS idx_evidence_items_case_id ON evidence_items(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_type ON evidence_items(type);
CREATE INDEX IF NOT EXISTS idx_evidence_items_timestamp ON evidence_items(timestamp);

CREATE INDEX IF NOT EXISTS idx_rule_defs_active ON rule_defs(active);
CREATE INDEX IF NOT EXISTS idx_rule_defs_owner ON rule_defs(owner);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
`;

// Default rules
const insertDefaultRulesSQL = `
INSERT INTO rule_defs (id, name, description, yaml_definition, owner) VALUES
('R-001', 'warrant_validity_check', 'Flag if warrant search time window does not include evidence timestamp', $yaml1$, 'system'),
('R-010', 'timestamp_anomaly', 'Flag evidence items with impossible timestamps', $yaml3$---
name: timestamp_anomaly
description: "Flag evidence items with impossible timestamps"
when:
  - field: evidence.type
    operator: exists
    value: true
conditions:
  - field: evidence.timestamp
    operator: greater_than
    value: "{{now}}"
actions:
  - type: create_alert
    severity: medium
    message: "Evidence timestamp is in the future. Verify timestamp accuracy."
    evidence_refs: ["{{evidence.id}}"]
$yaml3$, 'system'),
('R-015', 'missing_corroboration', 'Flag witness statements without corroborating evidence', $yaml4$---
name: missing_corroboration
description: "Flag witness statements without corroborating evidence"
when:
  - field: evidence.type
    operator: equals
    value: witness_statement
conditions:
  - field: evidence.corroborating_evidence_count
    operator: less_than
    value: 1
actions:
  - type: create_alert
    severity: low
    message: "Witness statement may lack corroboration. Consider gathering additional evidence."
    evidence_refs: ["{{evidence.id}}"]
$yaml4$, 'system')
ON CONFLICT (id) DO NOTHING;
`;
