# Quida

Quida is a Spanish first web app (PWA) for Puerto Rican families caring for an elder. The elder
talks or takes a photo; her family, on the island or in the States, reviews and approves what
changed; the elder gets back one simple card of what to do. A fixed safety Fence runs before any
AI: Quida never diagnoses and never changes medication, and emergencies point to 911.

Built for the Caribbean AI Summit Healthcare Hackathon, Puerto Rico, October 2026.

## Datos sintéticos

Every person, doctor, pharmacy, plan and recording in this repo is fictional. The demo case is
Doña Carmen Rivera (78, Adjuntas) and her daughter Marisol (Orlando). No real health information.

## Run it

```bash
npm i
npm run dev
```

Open http://localhost:3000 and choose Paciente or Familia. "Reiniciar demo" reloads the
synthetic case.

| Variable | Default | Meaning |
|---|---|---|
| `QUIDA_STORE` | `mock` | Shared state backend. `mock` keeps events in server memory. |
| `AI_GATEWAY_API_KEY` | unset | Vercel AI Gateway key. Without it, AI routes return labeled `SIMULADO` fixtures. |

## Layout

- `app/` routes: `/` role chooser, `/paciente`, `/familia`, `app/api/*` route handlers
- `lib/store/` `EventStore` interface and the in memory `MockStore`
- `lib/seed/` the synthetic case
- `lib/fence/` the deterministic safety tripwire and its fixed copy
- `components/ui/` shared badges, buttons and Fence notices
- `docs/BUILDLOG.md` one line per finished task
