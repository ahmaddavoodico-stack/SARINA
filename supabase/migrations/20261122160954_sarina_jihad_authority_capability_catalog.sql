alter table public.organization_capabilities
  drop constraint organization_capabilities_code_check;

alter table public.organization_capabilities
  add constraint organization_capabilities_code_check
  check (capability_code = any (array[
    'oversight.farmer.read',
    'oversight.farm.read',
    'oversight.expert.read',
    'oversight.productivity.read',
    'farmer.identity.read',
    'farmer.profile.summary.read',
    'oversight.support.read',
    'oversight.support.manage',
    'oversight.directive.publish',
    'oversight.directive.review',
    'oversight.recognition.issue',
    'oversight.reports.export',
    'farmer_credential.review',
    'expert_credential.review',
    'farmer_award.issue',
    'expert_award.issue',
    'reports.view',
    'services.manage',
    'service.requests.manage',
    'authority.registry.manage',
    'integrations.manage'
  ]));
