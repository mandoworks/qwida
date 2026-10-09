# MedSeekPR provider API: integration spec for Qwida

Counterparty: MedSeekPR founder. Consumer: Qwida `/proveedores` (caregiver side, Spanish UI, Puerto Rico).
Goal: replace the frozen ORCPS+NPPES snapshot with live MedSeekPR data.
Status: confirmed against staging 2026-10-09 (two read-only probes, 2 + 122 records).
Nothing here invents records. Null means "no public data", rendered honestly.

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

Base URL staging: `https://staging.medseekpr.com` (demo login until 2026-10-13).
Production: `https://medseekpr.com`. No API key; staging sits behind shared demo
basic auth. Rate limit 60 req/min. All responses JSON, UTF-8. Spanish labels where
shown to caregivers.

### 2.1 `GET /api/search` (confirmed live, phase 1)

Server-side filtering. Returns a **bare JSON list, no envelope, no total**; the
client counts and paginates. Verified params: `pueblo`, `especialidad`, `limit`
(limit to 1000, per the founder). Filter by categoría and pueblo for best results.

Verified 2026-10-09:

```json
[
  {
    "nombre": "GERARDO",
    "inicial": null,
    "apellidos": "ALAYON ANTA",
    "especialidad": "CARDIOLOGIA",
    "npi": "1508855644",
    "direccion_trabajo": "2520 AVE OBISPADO",
    "pueblo": "PONCE",
    "estado": "PR",
    "codigo_postal": "00716-3841",
    "telefono": "787-844-3153",
    "data_source": "nppes_pr",
    "source_id": null,
    "has_scheduling": 0,
    "sort_order": 5
  }
]
```

Measured: `pueblo=PONCE&especialidad=MEDICINA INTERNA&limit=1000` returns 122 rows,
all with phone, all `data_source=nppes_pr`, all `has_scheduling=0`. Do not rely on
`has_scheduling` until confirmed.

Query params (verified):

| Param | Type | Required | Notes |
|---|---|---|---|
| `especialidad` | string | no | free-text category, e.g. `CARDIOLOGIA`, `MEDICINA INTERNA`. |
| `pueblo` | string | no | exact municipio, e.g. `PONCE`, `SAN JUAN`. |
| `limit` | int | no | up to 1000. No offset param observed; pull the full town list in one call. |

### 2.2 Detail pages: `/p/{npi}` (confirmed by founder, phase 1)

No detail JSON endpoint observed. The per-professional page is the NPI deep link:
staging `https://staging.medseekpr.com/p/{npi}`, production `https://medseekpr.com/p/{npi}`.
Qwida cards link out to it (verified profile, map, office details). The `npi` field
in every search record is the stable cross-system id: it also joins to NPPES and,
via the license field there, to the ORCPS snapshot.

Field rules for the Qwida client, given the confirmed schema:

- The search record carries **no license number, no license status, no availability,
  and no plan data**. The ORCPS frozen snapshot stays the license-truth source
  (ACTIVO only, restricted excluded) until MedSeekPR ships status. Join on name plus
  NPI-to-NPPES license.
- `accepts_new_patients` and `plans_accepted` do not exist in the record. Render
  "No hay datos públicos" / "Llame para confirmar". Insurer data is limited per the
  founder: omit plan filters in the demo, show "Confirmar plan médico por teléfono".
- `telefono` / `direccion_trabajo`: practice location only. No personal numbers,
  no patient data, ever.
- Attribution is fixed, on every card and in the footer:
  "Datos provistos por MedSeek · medseekpr.com".

### 2.3 Facets: client-side from `/api/search` (no facet endpoint observed)

No specialties/municipios endpoint observed. Not needed: `limit=1000` pulls a full
town list in one call (122 rows for Medicina Interna in Ponce), so Qwida computes
the `Label (count)` filter options locally with the existing `specialtyOptions` /
`municipioOptions` helpers. Revisit if any town list passes ~2k rows.

### 2.4 Change feed or webhook (phase 2)

License status is the safety-critical field. Required eventually: `GET /changes?since=<iso>`
returning `{id, changed_field, old, new, changed_at}`, or a webhook POST on
`license_status` / `has_restriction` changes. Polling fallback today is a full refresh;
confirm the acceptable refresh cadence and rate limit.

## 3. Taxonomies to agree

### 3.1 Specialty values (client-side normalization)

The API takes free-text `especialidad` (`CARDIOLOGIA`, `MEDICINA INTERNA`) and
echoes it back per record. There is no code taxonomy, so Qwida keeps its own
`SPECIALTIES` map and substring matching (`lib/providers/search.ts`). Minimum
set to verify live: cardiología, cardiología intervencional, cardiología
pediátrica, enfermedades cardiovasculares, medicina interna, neurología,
endocrinología, pediatría.

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
| Auth | No API key. Staging behind shared demo basic auth, expires 2026-10-13. Confirm production auth before the demo window closes. |
| Environments | Staging `https://staging.medseekpr.com` plus production `https://medseekpr.com`. Staging fixture stability unknown; keep the frozen ORCPS JSON as the offline fallback. |
| Rate limits | 60 req/min, confirmed. Current ORCPS gentleman's rate was 1 req/s; the new budget allows live search plus a nightly refresh. |
| Pagination | `total` trustworthy, stable sort, short page terminates. Max page_size >= 200. |
| Latency/SLA | p95 target for `/api/search` at limit 1000; uptime commitment; status page or contact. |
| Freshness | `verified_at`/`updated_at` semantics, refresh cadence of license status, max staleness guarantee. |
| Terms | Written permission to display records in a public hackathon demo and beyond; attribution wording; redistribution limits; confirmation that only professional fields are exposed. |
| Privacy | No home addresses, no personal phones, no patient data in any field. Right to exclude a restricted professional entirely. |
| Encoding | Names arrive unescaped UTF-8 (ORCPS sends HTML entities like `QUI&#209;ONES`; do not repeat that). |
| Locales | Spanish labels for specialties, municipios, and availability states. No em dashes in UI-facing strings. |

## 5. Acceptance checklist (demo day)

1. `/api/search?especialidad=CARDIOLOGIA&pueblo=PONCE&limit=1000` returns the Ponce cardiologists with phones.
2. Same for neurología and endocrinología, nonzero.
3. SAN JUAN covered (the ORCPS gap that blocked wave 3).
4. Every card links `/p/{npi}` and carries "Datos provistos por MedSeek · medseekpr.com"; footer repeats it.
5. No availability or plan fields shown as fact; honest nulls only.
6. Frozen ORCPS snapshot still serves license status when staging is unreachable.
7. tsc, lint, and unit tests pass with the new client; no `next build` in lane scope.

## 6. Open questions for the founder (answered ones struck)

1. San Juan: covered? Volume and freshness? (Asked; verify live with one SAN JUAN query.)
2. ~~Availability and plan acceptance data?~~ Answered 2026-10-09: limited, omit in demo.
3. ~~Rate limit and key?~~ Answered: 60 req/min, no key.
4. ~~Attribution?~~ Answered: "Datos provistos por MedSeek · medseekpr.com", every card and footer.
5. License status/restriction feed: live ORCPS passthrough or cached? Still open, still the safety-critical gap.
6. Production auth after the 2026-10-13 staging window: still open.

## 7. Appendix: current Qwida references

- `lib/providers/catalog.ts`: record schema and merge/dedupe logic to retire.
- `lib/providers/search.ts`: `SPECIALTIES`, `searchProviders`, count-bearing filter options.
- `lib/providers/referido.ts`: `nudgeEvent` payload (fields the tap needs: name, license, phone, municipio, source).
- `app/proveedores/page.tsx`, `components/providers/*`: rendering contract above.
- `scripts/fetch-orcps.mjs`: refresh job and its gotchas (unreliable totals, duplicate rows, HTML entities, slow TLS, San Juan 500s) that the new API must not reproduce.
