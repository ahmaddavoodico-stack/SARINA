-- SARINA | Migration 003: AI Assistant and Expert Services
-- Depends on migrations 001 and 002. PostgreSQL 15+.
BEGIN;

CREATE TABLE ai_providers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_code VARCHAR(80) NOT NULL UNIQUE,
 display_name VARCHAR(160) NOT NULL,
 provider_type VARCHAR(30) NOT NULL DEFAULT 'model_api'
   CHECK (provider_type IN ('model_api','self_hosted','regional_service','other')),
 status VARCHAR(20) NOT NULL DEFAULT 'inactive'
   CHECK (status IN ('active','inactive','maintenance','restricted')),
 secret_ref TEXT, -- Secret-vault reference only; never store raw API keys.
 configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_models (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 provider_id UUID NOT NULL REFERENCES ai_providers(id) ON DELETE RESTRICT,
 model_code VARCHAR(120) NOT NULL,
 display_name VARCHAR(160) NOT NULL,
 capability VARCHAR(30) NOT NULL
   CHECK (capability IN ('text','vision','audio','multimodal','embedding','other')),
 context_limit INTEGER CHECK (context_limit IS NULL OR context_limit > 0),
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (provider_id, model_code)
);
CREATE INDEX ai_models_provider_capability_idx ON ai_models(provider_id, capability);

CREATE TABLE ai_conversations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
 title VARCHAR(240),
 conversation_type VARCHAR(30) NOT NULL DEFAULT 'farm_assistance'
   CHECK (conversation_type IN ('farm_assistance','general','diagnostic','planning','expert_handoff')),
 language_code VARCHAR(10) NOT NULL DEFAULT 'en',
 status VARCHAR(20) NOT NULL DEFAULT 'active'
   CHECK (status IN ('active','archived','closed')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_conversations_user_updated_idx ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX ai_conversations_farm_updated_idx ON ai_conversations(farm_id, updated_at DESC);

CREATE TABLE ai_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
 sender_type VARCHAR(20) NOT NULL
   CHECK (sender_type IN ('user','assistant','system','expert','tool')),
 sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL,
 message_text TEXT,
 content_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
 status VARCHAR(20) NOT NULL DEFAULT 'complete'
   CHECK (status IN ('queued','streaming','complete','failed','redacted')),
 token_input INTEGER CHECK (token_input IS NULL OR token_input >= 0),
 token_output INTEGER CHECK (token_output IS NULL OR token_output >= 0),
 latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (message_text IS NOT NULL OR jsonb_array_length(content_parts) > 0)
);
CREATE INDEX ai_messages_conversation_time_idx ON ai_messages(conversation_id, created_at);
CREATE INDEX ai_messages_sender_time_idx ON ai_messages(sender_user_id, created_at DESC);

CREATE TABLE ai_message_feedback (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 message_id UUID NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
 feedback_code VARCHAR(50),
 comment TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (message_id, user_id)
);

CREATE TABLE ai_analysis_runs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
 conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
 model_id UUID REFERENCES ai_models(id) ON DELETE SET NULL,
 analysis_type VARCHAR(40) NOT NULL
   CHECK (analysis_type IN ('image_diagnosis','farm_assessment','soil_interpretation',
     'water_interpretation','weather_risk','crop_planning','other')),
 status VARCHAR(24) NOT NULL DEFAULT 'queued'
   CHECK (status IN ('queued','running','succeeded','failed','needs_expert_review')),
 input_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
 result_summary TEXT,
 result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
 confidence_level VARCHAR(20)
   CHECK (confidence_level IN ('low','medium','high','unknown')),
 safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
 started_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
);
CREATE INDEX ai_analysis_farm_created_idx ON ai_analysis_runs(farm_id, created_at DESC);
CREATE INDEX ai_analysis_status_created_idx ON ai_analysis_runs(status, created_at);

CREATE TABLE farm_recommendations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
 field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
 crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
 analysis_run_id UUID REFERENCES ai_analysis_runs(id) ON DELETE SET NULL,
 created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 recommendation_type VARCHAR(40) NOT NULL
   CHECK (recommendation_type IN ('irrigation','nutrition','soil','pest_disease',
     'climate_risk','cultivation','harvest','general')),
 title VARCHAR(240) NOT NULL,
 recommendation_text TEXT NOT NULL,
 evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
 confidence_level VARCHAR(20)
   CHECK (confidence_level IN ('low','medium','high','unknown')),
 risk_level VARCHAR(20) NOT NULL DEFAULT 'unknown'
   CHECK (risk_level IN ('low','moderate','high','critical','unknown')),
 requires_expert_review BOOLEAN NOT NULL DEFAULT FALSE,
 status VARCHAR(20) NOT NULL DEFAULT 'suggested'
   CHECK (status IN ('suggested','accepted','rejected','in_progress','completed','expired','withdrawn')),
 valid_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX farm_recommendations_farm_status_idx ON farm_recommendations(farm_id, status, created_at DESC);
CREATE INDEX farm_recommendations_cycle_idx ON farm_recommendations(crop_cycle_id);

CREATE TABLE recommendation_actions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 recommendation_id UUID NOT NULL REFERENCES farm_recommendations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action_type VARCHAR(24) NOT NULL
   CHECK (action_type IN ('accepted','rejected','started','completed','snoozed','commented')),
 notes TEXT,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX recommendation_actions_recommendation_time_idx
 ON recommendation_actions(recommendation_id, occurred_at DESC);

CREATE TABLE expert_profiles (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 public_name VARCHAR(180) NOT NULL,
 biography TEXT,
 country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
 verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
   CHECK (verification_status IN ('pending','verified','rejected','suspended')),
 years_experience SMALLINT CHECK (years_experience IS NULL OR years_experience >= 0),
 languages JSONB NOT NULL DEFAULT '[]'::jsonb,
 consultation_modes JSONB NOT NULL DEFAULT '["in_app_message"]'::jsonb,
 profile_visibility VARCHAR(20) NOT NULL DEFAULT 'private'
   CHECK (profile_visibility IN ('private','directory','public')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE expertise_categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 category_code VARCHAR(100) NOT NULL UNIQUE,
 display_name VARCHAR(160) NOT NULL,
 parent_id UUID REFERENCES expertise_categories(id) ON DELETE SET NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE expert_specialties (
 expert_profile_id UUID NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
 expertise_category_id UUID NOT NULL REFERENCES expertise_categories(id) ON DELETE RESTRICT,
 experience_note TEXT,
 PRIMARY KEY (expert_profile_id, expertise_category_id)
);

CREATE TABLE expert_credentials (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 expert_profile_id UUID NOT NULL REFERENCES expert_profiles(id) ON DELETE CASCADE,
 credential_type VARCHAR(80) NOT NULL,
 issuing_body VARCHAR(180),
 credential_ref VARCHAR(180),
 issued_on DATE,
 expires_on DATE,
 verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
   CHECK (verification_status IN ('pending','verified','rejected','expired')),
 document_ref TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (expires_on IS NULL OR issued_on IS NULL OR expires_on >= issued_on)
);

CREATE TABLE expert_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 farm_id UUID REFERENCES farms(id) ON DELETE SET NULL,
 field_id UUID REFERENCES farm_fields(id) ON DELETE SET NULL,
 crop_cycle_id UUID REFERENCES crop_cycles(id) ON DELETE SET NULL,
 assigned_expert_profile_id UUID REFERENCES expert_profiles(id) ON DELETE SET NULL,
 subject VARCHAR(240) NOT NULL,
 problem_description TEXT NOT NULL,
 request_type VARCHAR(40) NOT NULL DEFAULT 'general'
   CHECK (request_type IN ('crop_diagnosis','soil_water','irrigation','nutrition',
     'pest_disease','business','general')),
 priority VARCHAR(16) NOT NULL DEFAULT 'normal'
   CHECK (priority IN ('low','normal','high','urgent')),
 status VARCHAR(24) NOT NULL DEFAULT 'submitted'
   CHECK (status IN ('draft','submitted','assigned','in_progress','waiting_user',
     'resolved','closed','cancelled')),
 preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 resolved_at TIMESTAMPTZ
);
CREATE INDEX expert_requests_requester_created_idx ON expert_requests(requester_user_id, created_at DESC);
CREATE INDEX expert_requests_expert_status_idx ON expert_requests(assigned_expert_profile_id, status);
CREATE INDEX expert_requests_farm_idx ON expert_requests(farm_id, created_at DESC);

CREATE TABLE expert_consultations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id UUID NOT NULL UNIQUE REFERENCES expert_requests(id) ON DELETE CASCADE,
 consultation_mode VARCHAR(24) NOT NULL DEFAULT 'in_app_message'
   CHECK (consultation_mode IN ('in_app_message','voice','video','external_channel')),
 status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
   CHECK (status IN ('scheduled','active','completed','cancelled','no_show')),
 scheduled_start TIMESTAMPTZ,
 scheduled_end TIMESTAMPTZ,
 started_at TIMESTAMPTZ,
 ended_at TIMESTAMPTZ,
 external_session_ref TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (scheduled_end IS NULL OR scheduled_start IS NULL OR scheduled_end >= scheduled_start),
 CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE expert_consultation_messages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id UUID NOT NULL REFERENCES expert_consultations(id) ON DELETE CASCADE,
 sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 message_text TEXT,
 content_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (message_text IS NOT NULL OR jsonb_array_length(content_parts) > 0)
);
CREATE INDEX expert_consultation_messages_time_idx
 ON expert_consultation_messages(consultation_id, created_at);

CREATE TABLE expert_reviews (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id UUID NOT NULL UNIQUE REFERENCES expert_consultations(id) ON DELETE CASCADE,
 reviewer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
 review_text TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
