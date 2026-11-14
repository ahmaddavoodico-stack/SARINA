-- SARINA | Migration 001: Foundation
-- PostgreSQL 15+ recommended. This migration creates the initial foundation only.
-- PostGIS is intentionally optional; spatial columns can be added in a later migration.
-- Run in a new database. Back up before applying to an existing database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE countries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iso2            CHAR(2) NOT NULL UNIQUE,
    iso3            CHAR(3) UNIQUE,
    name_en         VARCHAR(120) NOT NULL,
    default_language VARCHAR(10),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(254),
    phone_e164      VARCHAR(20),
    full_name       VARCHAR(180),
    country_id      UUID REFERENCES countries(id) ON DELETE SET NULL,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
    account_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (account_status IN ('pending','active','suspended','closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_uq ON users (phone_e164) WHERE phone_e164 IS NOT NULL;

CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(80) NOT NULL UNIQUE,
    name        VARCHAR(120) NOT NULL,
    description TEXT
);

CREATE TABLE permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(120) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Scope type allows a role to be assigned globally, within an organization, or on a farm.
CREATE TABLE user_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    scope_type      VARCHAR(20) NOT NULL DEFAULT 'global'
                    CHECK (scope_type IN ('global','organization','farm')),
    scope_id        UUID,
    granted_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
      (scope_type = 'global' AND scope_id IS NULL) OR
      (scope_type IN ('organization','farm') AND scope_id IS NOT NULL)
    )
);
CREATE INDEX user_roles_user_scope_idx ON user_roles(user_id, scope_type, scope_id);

CREATE TABLE organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name      VARCHAR(240) NOT NULL,
    display_name    VARCHAR(180) NOT NULL,
    organization_type VARCHAR(40) NOT NULL
                    CHECK (organization_type IN
                    ('government','company','cooperative','laboratory','bank',
                     'insurer','research','university','ngo','supplier','buyer','other')),
    country_id      UUID REFERENCES countries(id) ON DELETE SET NULL,
    website_url     TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','verified','suspended','closed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX organizations_country_type_idx ON organizations(country_id, organization_type);

CREATE TABLE organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_title    VARCHAR(120),
    membership_role VARCHAR(30) NOT NULL DEFAULT 'member'
                    CHECK (membership_role IN ('owner','admin','manager','member','auditor')),
    status          VARCHAR(20) NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited','active','suspended','removed')),
    joined_at       TIMESTAMPTZ,
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE farms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    country_id      UUID REFERENCES countries(id) ON DELETE SET NULL,
    farm_name       VARCHAR(180) NOT NULL,
    total_area      NUMERIC(14,4),
    area_unit       VARCHAR(20) NOT NULL DEFAULT 'hectare',
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (total_area IS NULL OR total_area >= 0)
);
CREATE INDEX farms_owner_idx ON farms(owner_user_id);
CREATE INDEX farms_org_idx ON farms(organization_id);

CREATE TABLE farm_fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_name      VARCHAR(160) NOT NULL,
    area            NUMERIC(14,4),
    area_unit       VARCHAR(20) NOT NULL DEFAULT 'hectare',
    soil_description TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farm_id, field_name),
    CHECK (area IS NULL OR area >= 0)
);

CREATE TABLE farm_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    latitude        NUMERIC(9,6),
    longitude       NUMERIC(9,6),
    elevation_m     NUMERIC(8,2),
    location_source VARCHAR(30) NOT NULL DEFAULT 'user_pin'
                    CHECK (location_source IN ('device_gps','user_pin','manual_region','imported')),
    precision_m     NUMERIC(10,2),
    is_primary      BOOLEAN NOT NULL DEFAULT TRUE,
    confirmed_by_user BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CHECK ((latitude IS NULL) = (longitude IS NULL))
);
CREATE INDEX farm_locations_farm_idx ON farm_locations(farm_id);

CREATE TABLE location_permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_id         UUID REFERENCES farms(id) ON DELETE CASCADE,
    purpose         VARCHAR(80) NOT NULL,
    consent_status  VARCHAR(20) NOT NULL
                    CHECK (consent_status IN ('granted','denied','revoked')),
    consent_version VARCHAR(40) NOT NULL,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);
CREATE INDEX location_permissions_user_idx ON location_permissions(user_id, recorded_at DESC);

CREATE TABLE regional_data_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name     VARCHAR(180) NOT NULL,
    provider        VARCHAR(180),
    source_url      TEXT,
    license_name    VARCHAR(180),
    update_frequency VARCHAR(80),
    coverage_notes  TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE regional_datasets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id       UUID NOT NULL REFERENCES regional_data_sources(id) ON DELETE RESTRICT,
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    dataset_type    VARCHAR(80) NOT NULL,
    observed_at     TIMESTAMPTZ,
    retrieved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_until     TIMESTAMPTZ,
    quality_score   NUMERIC(5,2),
    confidence_level VARCHAR(20)
                    CHECK (confidence_level IN ('low','medium','high','unknown')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100)
);
CREATE INDEX regional_datasets_farm_type_time_idx
    ON regional_datasets(farm_id, dataset_type, retrieved_at DESC);
CREATE INDEX regional_datasets_payload_gin_idx ON regional_datasets USING GIN(payload);

CREATE TABLE messaging_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_code    VARCHAR(40) NOT NULL UNIQUE,
    display_name    VARCHAR(100) NOT NULL,
    channel_type    VARCHAR(30) NOT NULL
                    CHECK (channel_type IN ('in_app','whatsapp','telegram','sms','email','push','regional')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE messaging_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    channel_id      UUID NOT NULL REFERENCES messaging_channels(id) ON DELETE RESTRICT,
    country_id      UUID REFERENCES countries(id) ON DELETE SET NULL,
    provider_name   VARCHAR(120),
    external_account_ref VARCHAR(240),
    connection_status VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (connection_status IN ('pending','active','error','disabled')),
    credentials_secret_ref TEXT, -- Reference to a secrets vault; never store raw credentials here.
    configuration  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messaging_connections_org_idx ON messaging_connections(organization_id);

CREATE TABLE communication_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID REFERENCES messaging_connections(id) ON DELETE SET NULL,
    channel_id      UUID NOT NULL REFERENCES messaging_channels(id) ON DELETE RESTRICT,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound')),
    message_type    VARCHAR(30) NOT NULL DEFAULT 'notification',
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'queued'
                    CHECK (delivery_status IN ('queued','sent','delivered','failed','received')),
    provider_message_ref VARCHAR(240),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX communication_logs_user_time_idx ON communication_logs(user_id, occurred_at DESC);

CREATE TABLE integration_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    integration_name VARCHAR(180) NOT NULL,
    integration_type VARCHAR(30) NOT NULL
                    CHECK (integration_type IN ('api','webhook','sftp','file_exchange','legacy_gateway','other')),
    environment     VARCHAR(20) NOT NULL DEFAULT 'production'
                    CHECK (environment IN ('sandbox','staging','production')),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','active','error','disabled','revoked')),
    auth_method     VARCHAR(30)
                    CHECK (auth_method IN ('oauth2','api_key','m_tls','basic','signed_webhook','none','other')),
    credentials_secret_ref TEXT, -- Secret-vault reference only; no credentials or tokens in this table.
    configuration   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, integration_name, environment)
);
CREATE INDEX integration_connections_org_status_idx
    ON integration_connections(organization_id, status);

CREATE TABLE integration_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
    endpoint_name   VARCHAR(160) NOT NULL,
    direction       VARCHAR(10) NOT NULL CHECK (direction IN ('inbound','outbound','both')),
    http_method     VARCHAR(10),
    endpoint_path   TEXT,
    data_domain     VARCHAR(80),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (connection_id, endpoint_name)
);

CREATE TABLE integration_sync_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
    endpoint_id     UUID REFERENCES integration_endpoints(id) ON DELETE SET NULL,
    sync_direction  VARCHAR(10) NOT NULL CHECK (sync_direction IN ('inbound','outbound')),
    status          VARCHAR(20) NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
    idempotency_key VARCHAR(180),
    started_at      TIMESTAMPTZ,
    finished_at     TIMESTAMPTZ,
    records_read    INTEGER NOT NULL DEFAULT 0 CHECK (records_read >= 0),
    records_written INTEGER NOT NULL DEFAULT 0 CHECK (records_written >= 0),
    error_summary   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (connection_id, idempotency_key)
);
CREATE INDEX integration_sync_jobs_status_created_idx
    ON integration_sync_jobs(status, created_at);

CREATE TABLE integration_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id   UUID NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
    sync_job_id     UUID REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
    event_type      VARCHAR(80) NOT NULL,
    severity        VARCHAR(12) NOT NULL DEFAULT 'info'
                    CHECK (severity IN ('debug','info','warning','error','critical')),
    message         TEXT,
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX integration_logs_connection_time_idx
    ON integration_logs(connection_id, occurred_at DESC);

COMMIT;
