# MedSeekPR provider API: integration spec for Qwida

Counterparty: MedSeekPR founder. Consumer: Qwida `/proveedores` (caregiver side, Spanish UI, Puerto Rico).
Goal: replace the frozen ORCPS+NPPES snapshot with live MedSeekPR data.
Status: draft for review, 2026-10-09. Nothing here invents records. Null means "no public data", rendered honestly.

## 1. What Qwida renders today (must keep working)

Card fields per professional: name, specialty, municipio, "Licencia activa (verificada el <fecha>)",
practice phone or "No hay teléfono público", "Verificar licencia" link (ORCPS verification page),
"Usar con mi referido" tap (creates a `nudge` event with doctor name, license, phone, referral expiry).
Filters: specialty select and municipio select, each option with a live count, plus active-filter line
and "Quitar filtros". Honest chips: "¿Acepta pacientes nuevos? No hay datos públicos" and
"¿Acepta su plan? Llame para confirmar". Banner: "Datos públicos reales, consultados el <fecha>.
Qwida no recomienda médicos." Source notes with attribution and fetch date.

Current record shape (`lib/providers/catalog.ts`):

```ts
type ProviderRecord = {
  name: string;            // ORCPS fullName, uppercase, unescaped
  specialty: string;       // free-text certification list, e.g. "MEDICINA INTERNA, CARDIOLOGIA"
  municipio: string;       // uppercase, e.g. "PONCE"
  license_number: string;  // ORCPS licenseNumber, dedupe key today
  license_status: "ACTIVO";// only ACTIVO ships; restricted rows dropped, not flagged
  phone: string | null;    // NPPES practice phone or null
  source_url: string;      // ORCPS verification page
  fetched_at: string;      // ISO timestamp of snapshot
};
```

Current scale: 192 unique ACTIVO physicians, 4 specialties (cardiología, neurología,
medicina interna capped at 40/town, endocrinología), 5 municipios (Ponce, Caguas,
Manatí, Adjuntas, Utuado). San Juan excluded: ORCPS returns HTTP 500 for it.

## 2. Endpoints required

Base URL, versioning, and auth (API key header) to be confirmed by MedSeekPR.
All responses JSON, UTF-8, ISO 8601 dates. Spanish labels where shown to caregivers.

### 2.1 `GET /providers` (required, phase 1)

Search with server-side filtering and pagination.

Query params:

| Param | Type | Required | Notes |
|---|---|---|---|
| `specialty` | string | no | normalized code, see 3.1. Repeatable or comma list. |
| `municipio` | string | no | exact match, case and accent insensitive. |
| `q` | string | no | free text over name. |
| `license_status` | string | no | default `ACTIVO`. Only ACTIVO is displayed. |
| `accepts_new_patients` | boolean | no | filter; null means unknown, must be returnable. |
| `plan` | string | no | Plan Vital MCO filter, see 3.3. |
| `page` | int, 1-based | no | default 1. |
| `page_size` | int | no | default 50, max 200. |
| `sort` | string | no | default `municipio,name,license_number`. |

Response:

```json
{
  "data": [ { "id": "medseek-0001", "...": "see 2.2 record" } ],
  "page": 1,
  "page_size": 50,
  "total": 192,
  "fetched_at": "2026-10-09T18:35:38Z"
}
```

`total` must be trustworthy (ORCPS `totalRecords` reads 0 at most page sizes; do not repeat that).
Short page ends pagination. Stable ordering across pages.

### 2.2 `GET /providers/{id}` (required, phase 1)

Full record. `id` is stable forever (today we dedupe on license number, which breaks
when source strings change; a permanent id fixes the nudge event's doctor reference).

```json
{
  "id": "medseek-0001",
  "name": "ADRIAN PEREZ COCHRAN",
  "specialties": ["medicina-interna", "cardiologia"],
  "specialties_raw": "MEDICINA INTERNA, CARDIOLOGIA",
  "municipio": "PONCE",
  "practice_address": "Calle Ejemplo 123, Ponce, PR 00716",
  "phone": "787-812-0909",
  "phone_updated_at": "2026-09-01",
  "license_number": "11205",
  "license_status": "ACTIVO",
  "license_expires": "2027-12-31",
  "has_restriction": false,
  "verified_at": "2026-10-09T18:35:38Z",
  "verify_url": "https://orcps.salud.pr.gov/mbps/verificacion",
  "accepts_new_patients": null,
  "availability_updated_at": null,
  "plans_accepted": ["Triple-S", "MMM"],
  "plans_updated_at": "2026-10-01",
  "languages": ["es"],
  "hours": "Lun-Vie 8:00-17:00",
  "source": "ORCPS + MedSeekPR",
  "attribution": "string supplied by MedSeekPR, rendered verbatim",
  "updated_at": "2026-10-09T18:35:38Z"
}
```

Field rules:

- `specialties`: normalized codes from the agreed taxonomy (3.1). Never free text alone.
- `license_status`: only `ACTIVO` displayed. Restricted professionals are excluded from
  results, never flagged on a public card (fairness rule from the W9 lane).
- `accepts_new_patients` / `plans_accepted`: null/empty when unknown. Qwida renders
  "No hay datos públicos" / "Llame para confirmar". No fabricated availability chips.
- `phone`: practice location only. No personal numbers, no patient data, ever.
- `verify_url`: per-record deep link preferred; global ORCPS page accepted.
- `attribution`: exact string to print under "De dónde vienen estos datos".

### 2.3 `GET /specialties` and `GET /municipios` (required, phase 1, or one `GET /facets`)

Filter options with counts. Our selects render `Label (count)` where count is the rows
the option would leave under the other filter already applied.

```json
{ "specialties": [{ "value": "cardiologia", "label": "Cardiología", "count": 30 }] }
{ "municipios": [{ "value": "PONCE", "label": "Ponce", "count": 65 }] }
```

Accept query params mirroring `/providers` (the other filter) so counts stay correct.
Alternatively: omit this endpoint and guarantee `/providers` is fast enough for Qwida
to compute counts client-side from a full fetch (192 rows today, fine; revisit past ~2k).

### 2.4 Change feed or webhook (phase 2)

License status is the safety-critical field. Required eventually: `GET /changes?since=<iso>`
returning `{id, changed_field, old, new, changed_at}`, or a webhook POST on
`license_status` / `has_restriction` changes. Polling fallback today is a full refresh;
confirm the acceptable refresh cadence and rate limit.

## 3. Taxonomies to agree

### 3.1 Specialty codes

Minimum: `cardiologia`, `cardiologia-intervencional`, `cardiologia-pediatrica`,
`enfermedades-cardiovasculares`, `medicina-interna`, `neurologia`, `endocrinologia`,
`pediatria`, each with a Spanish `label`. Sub-specialty strings must remain matchable
(interventional and pediatric cardiology are separate filter options today).

### 3.2 Municipios

Full 78-municipio list with exact spellings. San Juan coverage is the explicit gap:
ORCPS 500s on San Juan, so confirm MedSeekPR covers it and at what volume.

### 3.3 Plans

Plan Vital MCO names as displayed to caregivers (First Medical, Menonita, Triple-S,
MMM, current list). Confirm which plans have provider-level acceptance data vs
network-membership only.

## 4. Non-functional requirements

| Item | Ask |
|---|---|
| Auth | API key in header, separate staging key. No user login for read endpoints. |
| Environments | Production base URL + staging with fixture data for CI. |
| Rate limits | Published limits; current ORCPS gentleman's rate is 1 req/s. Confirm sustained and burst. |
| Pagination | `total` trustworthy, stable sort, short page terminates. Max page_size >= 200. |
| Latency/SLA | p95 target for `/providers` at page_size 50; uptime commitment; status page or contact. |
| Freshness | `verified_at`/`updated_at` semantics, refresh cadence of license status, max staleness guarantee. |
| Terms | Written permission to display records in a public hackathon demo and beyond; attribution wording; redistribution limits; confirmation that only professional fields are exposed. |
| Privacy | No home addresses, no personal phones, no patient data in any field. Right to exclude a restricted professional entirely. |
| Encoding | Names arrive unescaped UTF-8 (ORCPS sends HTML entities like `QUI&#209;ONES`; do not repeat that). |
| Locales | Spanish labels for specialties, municipios, and availability states. No em dashes in UI-facing strings. |

## 5. Acceptance checklist (demo day)

1. `/providers?specialty=cardiologia&municipio=PONCE` returns the Ponce cardiologists with phones where known.
2. `/providers?specialty=neurologia` and `?specialty=endocrinologia` return nonzero results.
3. Every record has a stable `id`, `verified_at`, and `verify_url`.
4. Unknown availability renders as null, never as a green "accepting" flag.
5. Specialty and municipio facet counts match `/providers` results exactly.
6. tsc, lint, and the 276 unit tests still pass with the new client; no `next build` in lane scope.

## 6. Open questions for the founder

1. San Juan: covered, at what volume and freshness?
2. Availability and plan acceptance: real per-practice data, or network membership? Update cadence?
3. License verification: live ORCPS passthrough or cached? Max staleness? Restriction handling?
4. Phone/address: practice locations only? What is the update source and date?
5. Terms and attribution: exact display string, demo permission, rate limits, staging access?

## 7. Appendix: current Qwida references

- `lib/providers/catalog.ts`: record schema and merge/dedupe logic to retire.
- `lib/providers/search.ts`: `SPECIALTIES`, `searchProviders`, count-bearing filter options.
- `lib/providers/referido.ts`: `nudgeEvent` payload (fields the tap needs: name, license, phone, municipio, source).
- `app/proveedores/page.tsx`, `components/providers/*`: rendering contract above.
- `scripts/fetch-orcps.mjs`: refresh job and its gotchas (unreliable totals, duplicate rows, HTML entities, slow TLS, San Juan 500s) that the new API must not reproduce.
