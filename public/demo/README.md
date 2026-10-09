# Demo audio (synthetic)

Expected here: two short synthetic Spanish clips of a role played doctor visit, recorded by the
team or produced by the W7 synthetic lane. No real patients, no real doctors.

| File | Length | Content |
|---|---|---|
| `visita-1.webm` (or `.m4a`) | 30 to 60 s | Doctor prescribes a new medicine with drug, dose and frequency said clearly, gives a referido to a specialty, and says when the next visit is in relative terms ("en tres meses"). |
| `visita-2.webm` (or `.m4a`) | 20 to 40 s | Same shape, but the dose of one medicine is mumbled or missing, so the app must leave it null and ask back. Optionally the patient says "esa pastilla no me la voy a tomar" to show the Fence. |

Puerto Rican Spanish, persona Doña Carmen Rivera (78, Adjuntas), fictional doctor. Under
4 MB each. Test with: `curl -F audio=@public/demo/visita-1.webm localhost:3000/api/visit`.
