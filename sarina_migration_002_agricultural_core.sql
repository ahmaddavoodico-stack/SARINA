-- SARINA | Migration 002: Agricultural Core
-- Depends on migration 001 (foundation).
-- PostgreSQL 15+. Run after sarina_migration_001_foundation.sql.

BEGIN;

CREATE TABLE crop_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scientific_name VARCHAR(180),
    common_name     VARCHAR(180) NOT NULL,
    local_names     JSONB NOT NULL DEFAULT '{}'::jsonb,
    crop_category   VARCHAR(60),
    perennial       BOOLEAN NOT NULL DEFAULT FALSE,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX crop_catalog_common_name_idx ON crop_catalog(lower(common_name));
CREATE INDEX crop_catalog_local_names_gin_idx ON crop_catalog USING GIN(local_names);

CREATE TABLE crop_varieties (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_id         UUID NOT NULL REFERENCES crop_catalog(id) ON DELETE RESTRICT,
    variety_name    VARCHAR(180) NOT NULL,
    origin_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
    characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (crop_id, variety_name)
);

CREATE TABLE crop_cycles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_id        UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
    crop_id         UUID NOT NULL REFERENCES crop_catalog(id) ON DELETE RESTRICT,
    variety_id      UUID REFERENCES crop_varieties(id) ON DELETE SET NULL,
    cycle_name      VARCHAR(180),
    planting_date   DATE,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    planted_area    NUMERIC(14,4),
    area_unit       VARCHAR(20) NOT NULL DEFAULT 'hectare',
    planting_method VARCHAR(60),
    status          VARCHAR(24) NOT NULL DEFAULT 'planned'
                    CHECK (status IN ('planned','active','harvested','failed','cancelled')),
    notes           TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (planted_area IS NULL OR planted_area >= 0),
    CHECK (expected_harvest_date IS NULL OR planting_date IS NULL OR expected_harvest_date >= planting_date),
    CHECK (actual_harvest_date IS NULL OR planting_date IS NULL OR actual_harvest_date >= planting_date)
);
CREATE INDEX crop_cycles_farm_status_idx ON crop_cycles(farm_id, status);
CREATE INDEX crop_cycles_field_idx ON crop_cycles(field_id);
CREATE INDEX crop_cycles_crop_idx ON crop_cycles(crop_id);

CREATE TABLE soil_tests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_id        UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
    sample_code     VARCHAR(100),
    sampled_at      DATE NOT NULL,
    laboratory_name VARCHAR(180),
    test_method     VARCHAR(120),
    soil_texture    VARCHAR(80),
    ph              NUMERIC(5,2),
    ec_ds_m         NUMERIC(9,3),
    organic_matter_pct NUMERIC(6,3),
    calcium_carbonate_pct NUMERIC(6,3),
    nitrogen_mg_kg  NUMERIC(12,3),
    phosphorus_mg_kg NUMERIC(12,3),
    potassium_mg_kg NUMERIC(12,3),
    sodium_mg_kg    NUMERIC(12,3),
    chloride_mg_kg  NUMERIC(12,3),
    cec_cmol_kg     NUMERIC(10,3),
    report_file_ref TEXT,
    data_source     VARCHAR(30) NOT NULL DEFAULT 'laboratory'
                    CHECK (data_source IN ('laboratory','field_test','user_estimate','imported')),
    notes           TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ph IS NULL OR ph BETWEEN 0 AND 14),
    CHECK (ec_ds_m IS NULL OR ec_ds_m >= 0),
    CHECK (organic_matter_pct IS NULL OR organic_matter_pct BETWEEN 0 AND 100),
    CHECK (calcium_carbonate_pct IS NULL OR calcium_carbonate_pct BETWEEN 0 AND 100)
);
CREATE INDEX soil_tests_farm_sampled_idx ON soil_tests(farm_id, sampled_at DESC);
CREATE INDEX soil_tests_field_sampled_idx ON soil_tests(field_id, sampled_at DESC);

CREATE TABLE water_tests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    sample_code     VARCHAR(100),
    sampled_at      DATE NOT NULL,
    water_source    VARCHAR(80),
    laboratory_name VARCHAR(180),
    test_method     VARCHAR(120),
    ph              NUMERIC(5,2),
    ec_ds_m         NUMERIC(9,3),
    tds_mg_l        NUMERIC(12,3),
    sodium_mg_l     NUMERIC(12,3),
    calcium_mg_l    NUMERIC(12,3),
    magnesium_mg_l  NUMERIC(12,3),
    chloride_mg_l   NUMERIC(12,3),
    bicarbonate_mg_l NUMERIC(12,3),
    sar             NUMERIC(9,3),
    boron_mg_l      NUMERIC(9,3),
    report_file_ref TEXT,
    data_source     VARCHAR(30) NOT NULL DEFAULT 'laboratory'
                    CHECK (data_source IN ('laboratory','field_test','user_estimate','imported')),
    notes           TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ph IS NULL OR ph BETWEEN 0 AND 14),
    CHECK (ec_ds_m IS NULL OR ec_ds_m >= 0),
    CHECK (sar IS NULL OR sar >= 0)
);
CREATE INDEX water_tests_farm_sampled_idx ON water_tests(farm_id, sampled_at DESC);

CREATE TABLE irrigation_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_id        UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
    irrigation_method VARCHAR(40) NOT NULL
                    CHECK (irrigation_method IN ('flood','furrow','drip','sprinkler','manual','other')),
    water_source    VARCHAR(80),
    started_at      TIMESTAMPTZ NOT NULL,
    ended_at        TIMESTAMPTZ,
    water_volume_m3 NUMERIC(14,3),
    duration_minutes INTEGER,
    notes           TEXT,
    recorded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    CHECK (water_volume_m3 IS NULL OR water_volume_m3 >= 0),
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0)
);
CREATE INDEX irrigation_events_farm_started_idx ON irrigation_events(farm_id, started_at DESC);
CREATE INDEX irrigation_events_field_started_idx ON irrigation_events(field_id, started_at DESC);

CREATE TABLE crop_activities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_id        UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
    activity_type   VARCHAR(50) NOT NULL
                    CHECK (activity_type IN
                    ('planting','fertilizing','pruning','pest_control','disease_control',
                     'weeding','cultivation','harvesting','soil_amendment','other')),
    activity_date   TIMESTAMPTZ NOT NULL,
    description     TEXT,
    input_name      VARCHAR(180),
    input_quantity  NUMERIC(14,4),
    input_unit      VARCHAR(40),
    cost_amount     NUMERIC(14,2),
    cost_currency   CHAR(3),
    performed_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (input_quantity IS NULL OR input_quantity >= 0),
    CHECK (cost_amount IS NULL OR cost_amount >= 0)
);
CREATE INDEX crop_activities_farm_date_idx ON crop_activities(farm_id, activity_date DESC);
CREATE INDEX crop_activities_cycle_date_idx ON crop_activities(crop_cycle_id, activity_date DESC);

CREATE TABLE farm_observations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    field_id        UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
    crop_cycle_id   UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
    observation_type VARCHAR(50) NOT NULL
                    CHECK (observation_type IN
                    ('growth','pest','disease','water_stress','nutrient_deficiency',
                     'weather_damage','soil_condition','yield','general')),
    observed_at     TIMESTAMPTZ NOT NULL,
    description     TEXT,
    severity        VARCHAR(20)
                    CHECK (severity IN ('low','moderate','high','critical','unknown')),
    image_refs      JSONB NOT NULL DEFAULT '[]'::jsonb,
    location_latitude NUMERIC(9,6),
    location_longitude NUMERIC(9,6),
    reported_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (location_latitude IS NULL OR location_latitude BETWEEN -90 AND 90),
    CHECK (location_longitude IS NULL OR location_longitude BETWEEN -180 AND 180),
    CHECK ((location_latitude IS NULL) = (location_longitude IS NULL))
);
CREATE INDEX farm_observations_farm_time_idx ON farm_observations(farm_id, observed_at DESC);
CREATE INDEX farm_observations_type_time_idx ON farm_observations(observation_type, observed_at DESC);

CREATE TABLE weather_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    source_id       UUID REFERENCES regional_data_sources(id) ON DELETE SET NULL,
    observed_at     TIMESTAMPTZ NOT NULL,
    temperature_c   NUMERIC(6,2),
    feels_like_c    NUMERIC(6,2),
    relative_humidity_pct NUMERIC(5,2),
    precipitation_mm NUMERIC(9,2),
    wind_speed_m_s NUMERIC(8,2),
    wind_direction_deg NUMERIC(6,2),
    solar_radiation_w_m2 NUMERIC(10,2),
    data_kind       VARCHAR(20) NOT NULL DEFAULT 'observed'
                    CHECK (data_kind IN ('observed','forecast','historical_normal','user_reported')),
    quality_score   NUMERIC(5,2),
    raw_payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (relative_humidity_pct IS NULL OR relative_humidity_pct BETWEEN 0 AND 100),
    CHECK (precipitation_mm IS NULL OR precipitation_mm >= 0),
    CHECK (wind_speed_m_s IS NULL OR wind_speed_m_s >= 0),
    CHECK (wind_direction_deg IS NULL OR wind_direction_deg BETWEEN 0 AND 360),
    CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 100)
);
CREATE INDEX weather_records_farm_observed_idx ON weather_records(farm_id, observed_at DESC);
CREATE INDEX weather_records_source_idx ON weather_records(source_id);

COMMIT;
