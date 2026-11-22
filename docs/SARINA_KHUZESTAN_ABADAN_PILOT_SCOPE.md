# SARINA Khuzestan — Abadan Pilot Scope

Status: approved pilot geography; authority onboarding and geography import remain pending evidence.

## Approved pilot boundary
- Province: Khuzestan (استان خوزستان)
- County: Abadan (شهرستان آبادان)
- Initial city focus: Abadan (شهر آبادان)
- The pilot must distinguish the county from the city. Arvandkenar (اروندکنار) and Choebdeh (چوئبده) are not to be silently treated as neighborhoods of Abadan city; include them only when the verified official administrative dataset and the relevant Jihad service-center mandate support that scope.
- No fabricated service-center names, identifiers, boundary polygons, organization records, members, farmer records, or support statistics.

## Official geography source and validation gate
The National Cartographic Center's National Spatial Data Infrastructure (NSDI) identifies the National Administrative Divisions database as the authoritative public source, updated annually:
- https://iransdi.ncc.gov.ir/layersf/irdv
- Supporting institutional publication: National Cartographic Center, Quarterly Publication No. 122, Winter 1403, page describing the national administrative-divisions map and source process: https://ncc.gov.ir/uploads/1/2025/Jul/07/نشریه شماره 122.pdf

A secondary GitHub dataset may be used only as a transport/normalization aid after its source workbook, release year, source checksum, license/provenance, and record-level mapping have been checked against the official source. It is not itself a government authority:
- https://github.com/sajaddp/list-of-cities-in-Iran
- https://github.com/Hameds/IranCountryDivisions

Before importing:
1. Obtain the current official province/county/district/city/service-center records or export from the national portal / Ministry of Interior / Statistical Center.
2. Preserve source codes as strings (leading zeros matter), parent-child relationships, source release, retrieval date, source URL, checksum, and verification status.
3. Verify Khuzestan -> Abadan county -> Abadan city and any districts/service centers against the official record set.
4. Have the responsible Jihad authority confirm the actual agricultural service-center coverage and mandate; administrative city/county boundaries alone do not establish the agricultural office's jurisdiction.
5. Load only verified records; retain historical versions rather than overwriting codes or names.

## Organization onboarding gate
The first Jihad tenant is not to be invented or self-certified. Provisioning requires:
- Official legal organization name and organization type.
- Evidence of authority / written confirmation from the relevant Jihad office.
- Named authorized organization administrator and verified user account.
- Confirmed capability set and least-privilege role assignments.
- Confirmed geographic mandate (county and service-center scopes).
- Audit trail for verification, membership changes, and scope changes.

Until then, the organization dashboard remains unavailable to ordinary users and no fabricated organization/member rows are created.

## First pilot workflow
1. Authorized Jihad user signs in.
2. Server verifies active membership, verified organization, enabled capability, active geography scope, and farmer consent/legal basis.
3. User searches a SARINA farmer public code.
4. The server returns only consented/authorized identity and farm summary and records the access event.
5. Specialist assignment, institutional support ledger, productivity/outcome review, and directive workflows are introduced as subsequent slices with separate permissions and audit events.

## Pilot success criteria
- 100% of imported geography records have provenance and validated parent links.
- 100% of organization members are individually verified and role-scoped.
- Cross-county and cross-organization access tests are denied.
- Expired/revoked farmer consent immediately blocks future lookup.
- Every lookup and sensitive read is auditable.
- No dashboard metric is displayed unless it is computed from live, authorized records and clearly labeled by reporting period.
- The first pilot can be demonstrated with synthetic fixtures only in an isolated staging environment, never as production farmers or support history.
