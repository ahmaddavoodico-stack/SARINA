# Expert consultation workflow and credential security

## Existing schema reviewed
The implementation reuses the existing expert domain tables rather than creating parallel request or chat systems:
- `expert_profiles`, `expert_credentials`, `expert_specialties`, `expertise_categories`
- `expert_requests`, `expert_request_assignments`, `expert_consultations`, `expert_consultation_messages`
- `expert_request_reports`, `expert_audio_sessions`
- `users`, `roles`, `user_roles`

Existing RLS already constrains farmer requests to the farmer's own farm, and assignment response to the assigned verified expert. Directory results require verified status and directory/public visibility.

## Farmer-to-expert flow
1. Farmer searches the verified public directory.
2. Farmer selects a farm and expert, enters the issue and explicitly consents to the defined context scope.
3. SARINA creates an `expert_requests` row, an offered assignment and an in-app consultation.
4. Expert accepts or declines the offered assignment.
5. Farmer and assigned expert exchange messages through `expert_consultation_messages`.
6. Message and assignment response triggers create recipient-scoped `expert_case_notifications` rows.
7. Both sides receive Realtime updates; notification recipients can only update `read_at`.

## Credential documents
- Dedicated bucket: `expert-credentials`
- Private bucket, maximum 10 MiB, MIME allow-list: PDF, JPEG and PNG.
- Object path format: `<expert_profile_id>/<sarina_user_id>/<random-file-name>.<ext>`
- Upload and deletion are restricted to the owning expert profile; reads are restricted to the owner, central SARINA admin, or an organization reviewer with the existing `expert_credential.review` scoped capability.
- UI creates 90-second signed URLs only after the database/storage access checks pass.
- Credential records begin as `pending`; authorized review records reviewer, time and note.
- Experts cannot update their own profile verification status. A trigger rejects owner attempts; central admin review is separately authorized by RLS.

## Notifications
`expert_case_notifications` is RLS-protected and recipient-scoped. Authenticated clients have SELECT and column-limited UPDATE permission on `read_at` only. The table is included in `supabase_realtime`.

## Audio boundary
The existing schema includes `expert_audio_sessions` and the private `expert-voice-notes` bucket. This implementation does not claim to provide live WebRTC calling. The consultation channel currently supports text messaging and the pre-existing audio-note storage path; live voice/video transport requires a separately designed and tested signaling/media service.

## Verification
Migrations are applied to the connected Supabase project. Runtime checks confirmed:
- `expert-credentials` exists and `public=false`
- 10 MiB file-size cap
- three object policies for upload/read/delete
- notification table RLS enabled and two recipient policies
- notification table included in Realtime publication
- admin profile-review update policy exists
- authenticated UPDATE grant is limited to `read_at`

Supabase Security Advisor continues to report pre-existing project findings, including `public.spatial_ref_sys` without RLS and other tables with RLS but no policies. These are outside this change; PostGIS system data was not modified.
