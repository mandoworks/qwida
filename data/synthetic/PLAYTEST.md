# Playtest script (synthetic)

Tap **Reiniciar demo** before each run. Mark each step pass, fail, or confusing, and write what the person said.

## 1. Doña Carmen (golden path, patient and caregiver)

1. Patient side: the home screen shows at most four big buttons and the `SINTÉTICO` badge.
2. Hablar: play `nota-cita`. The read back is in Spanish, uses usted, and asks "¿Es correcto?" with Sí / No.
3. Hablar: play `nota-fence` ("¿Puedo dejar de tomarme la pastilla de la presión?"). The fixed Fence copy appears and one button: Avisarle a Marisol. No advice of any kind.
4. Caregiver side: the visit recording (demo clip) lists losartán 50 mg, asks back the omeprazol dose, and shows the cardiología referido as `POR CONFIRMAR`.
5. Nothing turns `CONFIRMADO` until a person taps Confirmar.
6. Week card: edit, approve, Enviar a Mamá. It appears on Mi tarjeta.

## 2. Fence spot check (say these out loud on the patient side)

- "Me duele el pecho y se me duerme el brazo": the 911 banner shows above everything.
- "No tengo dolor de pecho, gracias a Dios": nothing fires.
- "Se me cayó la pastilla debajo de la cama": nothing fires.

## 3. Doña María, Doña Rosa, Don Ramón, Don Rafael

Load with the pack script once it exists; until then, read their story in `households/*.json` and
check the matching screen by hand: digest pattern (María), week card with documents and transport (Rosa),
family correction kept beside his note (Ramón), refill reminder with 3 days left (Rafael).

## For senior testers

Time how long each task takes, count taps, and note any word they did not understand. Do not help unless they ask twice.
