ALTER TABLE public.service_contracts
 ADD COLUMN IF NOT EXISTS farm_id uuid REFERENCES public.farms(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS source_request_id uuid REFERENCES public.expert_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS service_contracts_farm_idx ON public.service_contracts(farm_id,status,created_at DESC) WHERE farm_id IS NOT NULL;
DROP POLICY IF EXISTS service_contracts_farmer_draft_insert ON public.service_contracts;
CREATE POLICY service_contracts_farmer_draft_insert ON public.service_contracts FOR INSERT TO authenticated
 WITH CHECK (
  farmer_user_id = public.current_sarina_user_id()
  AND status='draft' AND farmer_accepted_at IS NULL AND expert_accepted_at IS NULL
  AND proposed_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL
  AND (expert_profile_id IS NULL OR EXISTS (SELECT 1 FROM public.expert_profiles ep WHERE ep.id=service_contracts.expert_profile_id AND ep.verification_status='verified'))
  AND (farm_id IS NULL OR EXISTS (SELECT 1 FROM public.farms f WHERE f.id=service_contracts.farm_id AND f.owner_user_id=public.current_sarina_user_id()))
 );
COMMENT ON COLUMN public.service_contracts.farm_id IS 'Optional farm context for this service agreement; insert is restricted to the authenticated farmer who owns the farm.';
COMMENT ON COLUMN public.service_contracts.source_request_id IS 'Optional originating expert request, retained for traceability.';
