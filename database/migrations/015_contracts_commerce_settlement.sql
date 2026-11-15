-- SARINA Contract, Commerce and Settlement foundation (v1)
-- Contracts describe obligations; invoices describe amounts due; payment transactions record provider-confirmed money movement.
-- Client roles can create a farmer-owned draft contract and read records for contracts they participate in.
-- Acceptance, invoice issuance, payment confirmation and settlement remain trusted-server operations.

CREATE TABLE IF NOT EXISTS public.service_contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_code text NOT NULL UNIQUE DEFAULT ('SC-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
 farmer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 expert_profile_id uuid REFERENCES public.expert_profiles(id) ON DELETE RESTRICT,
 service_type text NOT NULL CHECK (service_type IN ('human_expert','ai_service','hybrid','field_service','organization')),
 service_key text,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 180),
 description text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','proposed','accepted','active','completed','cancelled','disputed','expired')),
 pricing_model text NOT NULL CHECK (pricing_model IN ('fixed_fee','milestone','subscription','per_use','result_based','hybrid')),
 currency_code char(3) NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
 base_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
 platform_fee_model text NOT NULL DEFAULT 'configured_rate' CHECK (platform_fee_model IN ('configured_rate','fixed_amount','none','negotiated')),
 platform_fee_rate numeric(7,4) CHECK (platform_fee_rate BETWEEN 0 AND 100),
 expert_result_share_rate numeric(7,4) CHECK (expert_result_share_rate BETWEEN 0 AND 100),
 result_definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result_definition)='object'),
 payment_schedule jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payment_schedule)='object'),
 terms_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(terms_snapshot)='object'),
 version integer NOT NULL DEFAULT 1 CHECK (version > 0),
 start_at timestamptz,
 end_at timestamptz,
 proposed_at timestamptz,
 farmer_accepted_at timestamptz,
 expert_accepted_at timestamptz,
 completed_at timestamptz,
 cancelled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((service_type IN ('human_expert','hybrid','field_service') AND expert_profile_id IS NOT NULL) OR service_type IN ('ai_service','organization')),
 CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at),
 CHECK (status NOT IN ('accepted','active','completed') OR farmer_accepted_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS service_contracts_farmer_status_idx ON public.service_contracts(farmer_user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS service_contracts_expert_idx ON public.service_contracts(expert_profile_id,status,created_at DESC) WHERE expert_profile_id IS NOT NULL;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_contracts_party_select ON public.service_contracts;
CREATE POLICY service_contracts_party_select ON public.service_contracts FOR SELECT TO authenticated
 USING (
  farmer_user_id = public.current_sarina_user_id()
  OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=service_contracts.expert_profile_id AND ep.user_id=public.current_sarina_user_id())
 );
DROP POLICY IF EXISTS service_contracts_farmer_draft_insert ON public.service_contracts;
CREATE POLICY service_contracts_farmer_draft_insert ON public.service_contracts FOR INSERT TO authenticated
 WITH CHECK (
  farmer_user_id = public.current_sarina_user_id()
  AND status='draft' AND farmer_accepted_at IS NULL AND expert_accepted_at IS NULL
  AND proposed_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL
  AND (expert_profile_id IS NULL OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=service_contracts.expert_profile_id AND ep.verification_status='verified'))
 );
REVOKE ALL PRIVILEGES ON TABLE public.service_contracts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON TABLE public.service_contracts TO authenticated;

CREATE TABLE IF NOT EXISTS public.contract_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE RESTRICT,
 invoice_number text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','void','overdue')),
 currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
 subtotal numeric(18,4) NOT NULL CHECK (subtotal >= 0),
 tax_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
 discount_amount numeric(18,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
 total_amount numeric(18,4) NOT NULL CHECK (total_amount >= 0),
 due_at timestamptz,
 issued_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (total_amount = subtotal + tax_amount - discount_amount),
 CHECK (status NOT IN ('issued','partially_paid','paid','overdue') OR issued_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS contract_invoices_contract_idx ON public.contract_invoices(contract_id,created_at DESC);
ALTER TABLE public.contract_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_invoices_party_select ON public.contract_invoices;
CREATE POLICY contract_invoices_party_select ON public.contract_invoices FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.service_contracts c WHERE c.id=contract_invoices.contract_id AND (
  c.farmer_user_id=public.current_sarina_user_id()
  OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=c.expert_profile_id AND ep.user_id=public.current_sarina_user_id())
 )));
REVOKE ALL PRIVILEGES ON TABLE public.contract_invoices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.contract_invoices TO authenticated;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_id uuid NOT NULL REFERENCES public.contract_invoices(id) ON DELETE RESTRICT,
 payer_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
 payment_provider text NOT NULL,
 provider_transaction_ref text,
 idempotency_key text UNIQUE,
 status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','pending','authorized','paid','failed','cancelled','refunded','chargeback')),
 amount numeric(18,4) NOT NULL CHECK (amount > 0),
 currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
 provider_payload_ref text,
 initiated_at timestamptz NOT NULL DEFAULT now(),
 confirmed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_provider,provider_transaction_ref),
 CHECK (status NOT IN ('paid','refunded','chargeback') OR confirmed_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS payment_transactions_invoice_idx ON public.payment_transactions(invoice_id,created_at DESC);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_transactions_party_select ON public.payment_transactions;
CREATE POLICY payment_transactions_party_select ON public.payment_transactions FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.contract_invoices i JOIN public.service_contracts c ON c.id=i.contract_id
  WHERE i.id=payment_transactions.invoice_id AND (
   c.farmer_user_id=public.current_sarina_user_id()
   OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=c.expert_profile_id AND ep.user_id=public.current_sarina_user_id())
  )));
REVOKE ALL PRIVILEGES ON TABLE public.payment_transactions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.payment_transactions TO authenticated;

CREATE TABLE IF NOT EXISTS public.contract_settlement_allocations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE RESTRICT,
 invoice_id uuid REFERENCES public.contract_invoices(id) ON DELETE RESTRICT,
 payment_transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
 recipient_type text NOT NULL CHECK (recipient_type IN ('expert','sarina','ai_provider','organization','farmer_refund')),
 recipient_ref text,
 allocation_kind text NOT NULL CHECK (allocation_kind IN ('platform_fee','expert_fee','provider_cost','result_share','refund','tax','other')),
 amount numeric(18,4) NOT NULL CHECK (amount >= 0),
 currency_code char(3) NOT NULL CHECK (currency_code ~ '^[A-Z]{3}$'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','eligible','processing','paid','failed','reversed','held')),
 eligible_at timestamptz,
 settled_at timestamptz,
 external_settlement_ref text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_settlement_contract_idx ON public.contract_settlement_allocations(contract_id,status,created_at DESC);
ALTER TABLE public.contract_settlement_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_settlement_party_select ON public.contract_settlement_allocations;
CREATE POLICY contract_settlement_party_select ON public.contract_settlement_allocations FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.service_contracts c WHERE c.id=contract_settlement_allocations.contract_id AND (
  c.farmer_user_id=public.current_sarina_user_id()
  OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=c.expert_profile_id AND ep.user_id=public.current_sarina_user_id())
 )));
REVOKE ALL PRIVILEGES ON TABLE public.contract_settlement_allocations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.contract_settlement_allocations TO authenticated;

CREATE TABLE IF NOT EXISTS public.contract_audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES public.service_contracts(id) ON DELETE RESTRICT,
 actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
 event_type text NOT NULL,
 event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contract_audit_events_contract_idx ON public.contract_audit_events(contract_id,created_at);
ALTER TABLE public.contract_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.contract_audit_events FROM PUBLIC,anon,authenticated;

COMMENT ON TABLE public.service_contracts IS 'Versioned service agreement snapshots between a farmer and human, AI, field or organization service providers. State transitions and acceptance are trusted-server operations.';
COMMENT ON TABLE public.contract_invoices IS 'System-issued invoices. Client roles have read-only access through contract participation.';
COMMENT ON TABLE public.payment_transactions IS 'Payment-provider transaction records; never store card, bank credentials or raw payment secrets here. Payment status is provider-confirmed.';
COMMENT ON TABLE public.contract_settlement_allocations IS 'System-calculated revenue splits and payouts. No client-side writes or payout execution.';
COMMENT ON TABLE public.contract_audit_events IS 'Append-only internal audit trail for contract, invoice, payment and settlement lifecycle events.';
