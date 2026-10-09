# Provider Tab & Protocol Engine Specification

**Location:** `qwida-warroom` / `qwida-app`  
**Route:** War room tab `Proveedores` (`/warroom#providers`) and consumer web app `/proveedores`  
**Status:** Shipped in War Room; integration spec delivered for MedSeekPR API  
**Last Updated:** 2026-10-09  

---

## 1. Overview & Mission Thesis

For Puerto Rican elderly patients and their families, securing a specialist appointment often requires months of waiting and traveling across municipal boundaries. Arriving at a clinic only to have an appointment canceled due to an expired referral, an unfasted state, or a missing creatinine test is devastating.

The Provider Tab and Protocol Engine solve both sides of this equation:
1. **Directory Discovery:** Island-wide search of the public physician directory across all 78 Puerto Rico municipalities, with practice phone numbers and addresses as the public sources publish them. Quida does not verify licenses or insurance plan acceptance; every card tells the family to call and confirm.
2. **"No Pierda el Viaje" Protocol Cards:** Actionable visit preparation guidelines covering fasting rules, prerequisite lab tests, 90-day referral validity, and mandatory escort rules so patients never make a wasted trip.

---

## 2. Architecture & Data Sources

```
+-------------------------------------------------------------+
|                 Qwida Provider Architecture                 |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
[Live Provider Search]                      [Offline Fallback & Seed]
  - MedSeekPR Live API                        - 192 doctors, frozen ORCPS/NPPES snapshot
  - /api/search, /api/pueblos                 - No plan acceptance verified by Quida
  - /api/provider-profile                     - 78 PR Municipalities
       |                                             |
       +----------------------+----------------------+
                              |
              +---------------+---------------+
              |                               |
     [War Room Dashboard]            [Consumer App /proveedores]
       - Directory Audit               - Family/Caregiver Directory
       - Protocol Cards QA             - "Usar con mi referido" Nudge
       - API Status Check              - Protocol Warnings on Cards
```

### Data Source Breakdown
- **MedSeekPR API (`medseekpr.com/api`):** Live discovery engine for 78 municipalities and 90+ specialties. Provides practice addresses, phone numbers, and scheduling indicators. MedSeekPR owns provider onboarding and registration.
- **Insurance plan acceptance:** not verified by Quida. When MedSeek PR reports a plan or new patient flag, the card shows it as "Según MedSeek PR" next to "Llame para confirmar".
- **Federal NPPES NPI Registry API (`npiregistry.cms.hhs.gov`):** Authoritative CMS verification for 10-digit National Provider Identifiers (NPI), official taxonomy codes, credentials (MD, DO), and physical clinic locations.
- **Clinical Practice Standards:** Synthesized prep protocols from Puerto Rico diagnostic facilities, clinical laboratories (Laboratorios Toledo, Borinquen), and health plan guidelines.

---

## 3. Data Schemas

### 3.1 Provider Record Schema (`providers-seed.json`)

```json
{
  "name": "Dr. Rigoberto Ramos Gonzalez",
  "specialty": "Cardiólogo",
  "town": "Adjuntas",
  "address": "Carr #135 Km 1.2, Adjuntas, PR 00601",
  "phone": "787-829-5112",
  "plans": []
}
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Normalized full name in Title Case (prefixes Dr./Dra. standardized). |
| `specialty` | `string` | Clinical specialty in Spanish from the 13 approved categories. |
| `town` | `string` | Standardized Puerto Rico municipality name with proper Spanish accents. |
| `address` | `string` | Clinic or office physical street address. |
| `phone` | `string` | Formatted 10-digit telephone number (`787-XXX-XXXX` or `939-XXX-XXXX`). |
| `plans` | `string[]` | Health plans as reported by the public source, never verified by Quida. Empty array means unconfirmed; never fabricated. |

### 3.2 Protocol Card Schema (`protocols-2026-10-09.json`)

```json
{
  "id": "rad_ct_con_contraste",
  "category": "imagenes_radiologia",
  "title": "CT Scan con Medio de Contraste Intravenoso",
  "procedure_name": "Contrast-Enhanced Computed Tomography",
  "dont_waste_a_trip_summary": "OBLIGATORIO llevar resultado de Creatinina reciente (<30-60 días). Sin creatinina, cancelan el estudio.",
  "ayuno_horas": 4,
  "ayuno_detalle": "Ayuno de 4 a 6 horas para sólidos antes del procedimiento.",
  "medicamentos_reglas": "Suspender Metformina 48 horas después del contraste según indicación médica.",
  "pruebas_previas_requeridas": [
    "Prueba de Creatinina y Tasa de Filtración Glomerular (eGFR) < 30-60 días"
  ],
  "referido_requerido": true,
  "referido_detalle": "Orden médica y Precertificación activa con número de autorización.",
  "acompanante_requerido": true,
  "acompanante_detalle": "Recomendado para pacientes mayores que reciben contraste.",
  "ropa_y_preparacion_fisica": "Ropa sin metales ni cremalleras. Retirar prótesis y joyas.",
  "documentos_a_llevar": [
    "Resultado impreso de Creatinina reciente (INDISPENSABLE)",
    "Orden médica original",
    "Hoja de Precertificación aprobada",
    "Tarjeta del plan médico e ID con foto"
  ],
  "fallo_comun_que_cancela_la_cita": "Llegar sin el resultado de laboratorio de creatinina."
}
```

---

## 4. Specialties Covered (13 Categories)

1. **Geriatra (Geriatric Medicine):** Specialized elder care, medication reconciliation.
2. **Cardiólogo (Cardiovascular Disease):** Heart failure, hypertension, arrhythmias.
3. **Neurólogo (Neurology):** Memory care, dementia, Alzheimer's, Parkinson's, stroke.
4. **Oftalmólogo (Ophthalmology):** Glaucoma, cataracts, macular degeneration, diabetic retinopathy.
5. **Endocrinólogo (Endocrinology):** Diabetes management, insulin therapy, thyroid disorders.
6. **Nefrólogo (Nephrology):** Chronic kidney disease, dialysis evaluation, electrolytes.
7. **Neumólogo (Pulmonary Disease):** COPD, asthma, pulmonary fibrosis.
8. **Ortopeda (Orthopaedic Surgery):** Joint replacement, fractures, falls, mobility.
9. **Reumatólogo (Rheumatology):** Arthritis, autoimmune inflammation, joint pain.
10. **Fisiatra (Physical Medicine & Rehabilitation):** Post-stroke rehabilitation, mobility recovery.
11. **Psiquiatra (Psychiatry):** Geriatric mental health, mood and cognitive disorders.
12. **Médico Internista (Internal Medicine):** Comprehensive adult primary care.
13. **Médico de Familia (Family Medicine):** General primary and preventive family care.

---

## 5. Protocol Categories ("No Pierda el Viaje")

| Protocol ID | Procedure / Visit | Primary Trap (Fallo Común) |
|---|---|---|
| `lab_perfil_lipidico_glucosa` | Perfil Lipídico y Glucosa | Desayunar, tomar café o saltar hidratación con agua. |
| `rad_sonograma_abdominal` | Sonograma Abdominal | Tomar café, masticar chicle o comer en las 8h previas. |
| `rad_sonograma_pelvico` | Sonograma Pélvico / Vejiga | Orinar en recepción antes del turno (vejiga debe estar llena). |
| `rad_mamografia` | Mamografía | Aplicarse desodorante, talco o perfume en axilas/pecho. |
| `rad_ct_con_contraste` | CT Scan con Contraste | Olvidar resultado de laboratorio de creatinina sérica. |
| `cardio_prueba_esfuerzo` | Prueba de Esfuerzo | Consumir cafeína 24h antes (bloquea receptores cardíacos). |
| `gastro_colonoscopia` | Colonoscopía | Llegar sin acompañante adulto que conduzca tras sedación. |
| `oftalmo_dilatacion_pupila` | Consulta Oftalmológica con Dilatación | Llegar guiando solo sin chofer y sin gafas de sol. |
| `neuro_evaluacion_cognitiva` | Consulta Inicial de Neurología | Acudir sin familiar/cuidador y sin frascos físicos de medicinas. |
| `endocrino_control_diabetes` | Consulta de Endocrinología | Llegar sin bitácora de azúcar y sin reporte reciente de A1c. |
| `admin_regla_referidos_90_dias` | Regla General de Referidos | Cita tardó 4 meses y el referido caducó a los 90 días. |

---

## 6. Truth & Safety Boundaries

1. **Zero Fabrication:** Never invent physicians, telephone numbers, or insurance acceptance. If a field is unconfirmed, render `"Confirmar con consultorio"` or leave empty.
2. **Honest Simulation Label:** All demo appointment availability and real-time scheduling indicators are clearly disclosed with `"Disponibilidad simulada para la demo"`.
3. **No Medication Directives:** Protocol cards instruct patients to consult their physician regarding medication changes (e.g., insulin or beta-blockers). Never advise stopping or starting medication unilaterally.
4. **Unfindable Data Disclosed:** Clearly document that walk-in cutoffs and same-day cancellation slots are managed internally on paper notebooks by clinic receptionists, requiring phone confirmation between 8:00 AM and 9:00 AM.
