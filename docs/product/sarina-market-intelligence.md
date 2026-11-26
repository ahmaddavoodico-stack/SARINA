# SARINA Market Intelligence
## Product scope and first Manus pilot

**Purpose:** Help farmers connect their products to domestic and global markets through evidence-backed market research, buyer discovery, standards, packaging, permits, export readiness, and trade economics.

## Product capabilities
1. Market research: demand, price trends, importing countries, competitors, and market opportunities.
2. Global markets and buyers: target-market assessment and identification of buyer categories and verifiable discovery channels.
3. Standards and compliance: quality grades, food safety, pesticide residue limits, traceability, phytosanitary and destination-market requirements.
4. Packaging intelligence: material, dimensions, net weight, labeling, shelf life, handling, palletization, and cold-chain fit.
5. Permits and certifications: domestic export permissions, health and phytosanitary certificates, customs documents, and destination-country import requirements.
6. Export readiness and trade economics: logistics, shipping, cost components, risks, and readiness gaps.
7. Domestic market readiness must be supported alongside export workflows.

## Evidence and governance rules
- Cite official primary sources first: competent ministries, customs, plant-protection authorities, food-safety regulators, standards bodies, and official destination-country import portals.
- Industry sources may supplement but must not replace official legal/regulatory sources.
- Record source title, issuing authority, URL, publication/effective date when available, access date, product, origin, destination, and applicability.
- Distinguish mandatory legal requirements from voluntary standards, private buyer specifications, and commercial recommendations.
- Never infer a permit, certification, tariff, residue limit, or packaging rule without a source.
- If requirements conflict or cannot be verified, mark them unresolved and identify the competent authority.
- Label estimates and assumptions separately from verified facts.
- Do not contact companies or buyers, publish content, make commitments, or change SARINA production data.
- Manus may save a research result only as a private pending-review draft through the approved SARINA MCP tool. A human reviewer must approve it before it becomes trusted knowledge or is shown as verified guidance.

## First pilot mission
**Working test case:** Iranian dates (origin: Khuzestan/Iran) for potential export to the United Arab Emirates. This is a research scenario only, not a claim that the product or exporter is currently export-ready.

### Questions
1. What date varieties and product forms are imported by the UAE, and what official trade data can be verified?
2. What are the applicable UAE import, food-safety, labeling, packaging, shelf-life, and phytosanitary requirements for dates from Iran?
3. Which Iranian domestic export permits and certificates may be required, and which competent authorities issue them?
4. What packaging formats and labeling elements are suitable for retail, wholesale, and food-service channels?
5. What transport, storage, temperature, handling, and logistics considerations matter?
6. What are the main cost components and risks? Provide a calculation framework; do not invent current prices or margins.
7. What evidence gaps and questions must an exporter confirm with official authorities or a licensed customs broker?

### Required output
- Executive summary and go/no-go considerations.
- Market overview with dated, cited official trade data where available.
- Regulatory and certification checklist split into Iran-side export and UAE-side import.
- Packaging matrix by sales channel.
- Logistics and handling checklist.
- Cost model with formulas and clearly marked unknown inputs.
- Risk register and unresolved questions.
- Source register with URLs, issuing bodies, dates, and confidence/applicability notes.
- Clear separation of verified facts, secondary-source claims, estimates, and assumptions.

### Acceptance criteria
- Every legal/regulatory claim has an official source or is explicitly marked unverified.
- Requirements are scoped to the stated product, origin, and destination.
- No made-up prices, buyers, permits, certifications, or market statistics.
- No external contact or publication.
- Save exactly one private SARINA market-research draft using `save_market_research_draft`, then retrieve it with `get_market_research_draft` and report the draft ID. Do not create another record if the save succeeds.
