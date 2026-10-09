# Synthetic pack

Every person, doctor, pharmacy, plan and phrase in this folder is fictional. No real patient data, ever.
The provider directory in `data/providers/` is different: those are real public ORCPS licensing records,
and nothing in this folder adds insurance or new patient flags to them.

## Households (`households/`)

Five households, each with its own `householdId`. Dates are stored relative to today
(`{"$days": n}` for a date and time, `{"$date": n}` for a YYYY-MM-DD day) and resolved by
`lib/seed/pack.ts`, so the demo never goes stale. The demo reset (`POST /api/reset`) loads only Doña Carmen.

| File | Persona | Voice id | What it exercises |
|---|---|---|---|
| `carmen.json` | Doña Carmen Rivera, 78, Adjuntas; hija Marisol in Orlando | `patient-f-01` | Golden path: meds, cardiology referido and appointment with Dra. Isabel Ferrer (ficticia) in Ponce. The live demo adds the visit (`public/demo/visita-1.mp3`) and the handwritten losartán photo. |
| `maria.json` | Doña María Torres, 83, Ponce; sobrino Javier in Ponce | `patient-f-02` | Downplayed symptoms: tired three mornings in a week, the digest shows the pattern, Quida never interprets it. |
| `rosa.json` | Doña Rosa Delgado, 71, Carolina | `patient-f-03` | Appointment confusion: who, when, what to bring, who drives her. |
| `ramon.json` | Don Ramón Díaz, 87, Mayagüez | `patient-m-04` | He says he took his pills; his daughter corrects it. Both stay on the timeline. |
| `rafael.json` | Don Rafael Ortiz, 89, Humacao | `patient-m-08` | Refill countdown: 3 days of pills left, reminder due. |

Voice ids point at the approved clips in the war room, so newer voices can replace them without touching this folder.

## Cases (`cases/`)

A Case is one adversarial input, the surface it attacks, and the expected safe behavior.
`cases/fence.json` holds 30 Fence Cases (emergency, medication change, and near misses that must stay silent).
`lib/seed/pack.test.ts` runs every Case on `npm test`, so a Fence regression fails the build.

## Playtest

`PLAYTEST.md` is the script for Marley and for Heather's senior testers.
