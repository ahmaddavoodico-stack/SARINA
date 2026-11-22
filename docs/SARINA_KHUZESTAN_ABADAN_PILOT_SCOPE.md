# SARINA Khuzestan — Abadan Pilot Scope

Status: pilot service coverage approved by the project owner; official geography codes and the Jihad authority's written service mandate remain validation gates before production access provisioning.

## Approved pilot service coverage
- Province: Khuzestan (استان خوزستان)
- Supervisory / service hub: Abadan (آبادان)
- Initial pilot service locations: Abadan (آبادان), Choebdeh (چوئبده), and Arvandkenar (اروندکنار).
- Choebdeh is the first field deployment location because the first pilot farm is located there.
- For this pilot, Choebdeh and Arvandkenar are included in the Abadan operational service and supervision scope, as explicitly confirmed by the project owner.
- This service-coverage decision does not reclassify either location as a neighborhood of Abadan city, nor does it assert an administrative hierarchy or official code. SARINA must retain the correct official administrative level for each place after validation against the current government dataset.
- The actual Jihad agricultural service-center mandate must be confirmed by the responsible authority before creating production organization scopes or granting official personnel access. The project owner's pilot coverage decision is not represented as a government-issued mandate.

## Geography source and validation gate
The National Cartographic Center's National Spatial Data Infrastructure (NSDI) identifies the National Administrative Divisions database as the authoritative public source:
- https://iransdi.ncc.gov.ir/layersf/irdv
- Supporting institutional publication: National Cartographic Center, Quarterly Publication No. 122, Winter 1403: https://ncc.gov.ir/uploads/1/2025/Jul/07/نشریه شماره 122.pdf

A secondary dataset may be used only as a transport/normalization aid after its source workbook, release year, checksum, license/provenance, and record-level mapping have been checked against the official source. It is not itself a government authority:
- https://github.com/sajaddp/list-of-cities-in-Iran
- https://github.com/Hameds/IranCountryDivisions

Before importing:
1. Obtain the current official province/county/district/city/rural-district/village and service-center records or export from the national portal / Ministry of Interior / Statistical Center.
2. Preserve source codes as strings (leading zeros matter), parent-child relationships, source release, retrieval date, source URL, checksum, and verification status.
3. Verify Khuzestan, Abadan, Choebdeh, and Arvandkenar at their correct official administrative levels; do not infer codes or parent-child relationships from informal descriptions.
4. Separately document the Abadan Jihad service hub's operational coverage of all three pilot locations, including the first farm in Choebdeh, using confirmation from the responsible Jihad authority before provisioning production access scopes.
5. Load only verified records; retain historical versions rather than overwriting codes or names.

## Organization onboarding gate
The first Jihad tenant is not to be invented or self-certified. Provisioning requires:
- Official legal organization name and organization type.
- Evidence of authority / written confirmation from the relevant Jihad office.
- Named authorized organization administrator and verified user account.
- Confirmed capability set and least-privilege role assignments.
- Confirmed geographic mandate covering Abadan, Choebdeh, and Arvandkenar for this pilot.
- Audit trail for verification, membership changes, and scope changes.

Until then, the organization dashboard remains unavailable to ordinary users and no fabricated organization/member rows are created.

## First pilot workflow
1. Authorized Jihad user signs in.
2. Server verifies active membership, verified organization, enabled capability, active geography scope, and farmer consent/legal basis.
3. User searches a SARINA farmer public code.
4. The server returns only consented/authorized identity and farm summary and records the access event.
5. First field demonstration starts with the Choebdeh farm; Abadan and Arvandkenar remain included in the pilot service coverage.
6. Specialist assignment, institutional support ledger, productivity/outcome review, and directive workflows are introduced as subsequent slices with separate permissions and audit events.

## Pilot success criteria
- 100% of imported geography records have provenance and validated parent links.
- The Abadan pilot service scope explicitly includes Abadan, Choebdeh, and Arvandkenar.
- 100% of organization members are individually verified and role-scoped.
- Cross-scope and cross-organization access tests are denied.
- Expired/revoked farmer consent immediately blocks future lookup.
- Every lookup and sensitive read is auditable.
- No dashboard metric is displayed unless it is computed from live, authorized records and clearly labeled by reporting period.
- The first pilot can be demonstrated with synthetic fixtures only in an isolated staging environment, never as production farmers or support history.
