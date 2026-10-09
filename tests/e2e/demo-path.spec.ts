import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * The 90 second demo path, one test per step, in order, sharing one page.
 * Serial: a failed step skips the rest, since each step reads what the last one saved.
 * Writes to the shared demo store, so it resets before and after.
 */
test.describe.configure({ mode: "serial" });

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

/** Slow steps go through transcription or vision models on the server. */
const AI_TIMEOUT = 90_000;

let page: Page;
let cardTitle = "";

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async ({ request }) => {
  await request.post("/api/reset");
  await page.close();
});

/** Uploads a fixture from the Foto screen's idle state and waits for the fields read from it. */
async function sendPhoto(name: string) {
  await page.getByLabel("O escoja una foto guardada").setInputFiles(fixture(name));
  await page.getByRole("button", { name: "Enviar foto" }).click();
  await expect(page.getByRole("region", { name: "Datos leídos de la foto" })).toBeVisible({ timeout: AI_TIMEOUT });
}

test("1. Reiniciar demo", async () => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reiniciar demo" }).click();
  await expect(page.getByRole("button", { name: "Demo reiniciada" })).toBeVisible();
});

test("2. Paciente: Grabar mi cita con la grabación de demostración", async () => {
  await page.goto("/paciente");
  await page.getByRole("link", { name: /^Grabar mi cita/ }).click();
  await page.getByLabel("Paciente acepta").check();
  await page.getByLabel("Médico acepta").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Usar la grabación de demostración/ }).click();

  const visit = page.getByRole("region", { name: "Grabar la visita médica" });
  await expect(visit.getByRole("heading", { name: "Lo que escuchamos" })).toBeVisible({ timeout: AI_TIMEOUT });
  await expect(visit).toContainText(/losartán/i);
  await expect(visit).toContainText(/cardiología/i);
});

test("3. Foto: receta a mano no es confiable y no se puede confirmar", async () => {
  await page.goto("/paciente");
  // The tile, not the label rescan notice's own Foto button.
  await page.getByRole("link", { name: /^Foto Toque/ }).click();
  await sendPhoto("rx-handwritten.jpg");
  await expect(page.getByText("Letra de médico: no confiable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toHaveCount(0);
});

test("4. Foto: confirmar la etiqueta crea el horario", async () => {
  await page.getByRole("button", { name: "Mandar otra foto" }).click();
  await sendPhoto("rx-label.jpg");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();

  // The label may need the patient to pick how many times a day.
  const schedule = page.getByRole("region", { name: "Horario de medicinas" });
  const frequency = page.getByRole("button", { name: "una vez al día" });
  await expect(schedule.or(frequency)).toBeVisible();
  if (await frequency.isVisible()) await frequency.click();

  await expect(schedule).toContainText(/losartán/i);
});

test("5. Foto: el referido muestra cuándo vence", async () => {
  await page.getByRole("button", { name: "Mandar otra foto" }).click();
  await sendPhoto("referido.jpg");
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText(/^Vence el /)).toBeVisible();
});

test("6. Cuidador: revisar la visita, aprobar y enviar la tarjeta", async () => {
  await page.goto("/cuidador/revisar");
  await page.getByRole("button", { name: /Grabación de la visita/ }).first().click();
  const item = page.getByRole("article");
  await item.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(item.getByText("Confirmado", { exact: true })).toBeVisible();

  await page.goto("/cuidador/tarjeta");
  await page.getByRole("button", { name: "Generar borrador" }).click();
  const title = page.getByRole("textbox", { name: "Título" });
  await expect(title).toBeVisible({ timeout: AI_TIMEOUT });
  cardTitle = await title.inputValue();
  expect(cardTitle).not.toBe("");

  await page.getByRole("button", { name: "Aprobar", exact: true }).click();
  await page.getByRole("button", { name: "Aprobar y enviar a Mamá" }).click();
  await expect(page.getByText("Enviada a Doña Carmen")).toBeVisible();
});

test("7. Paciente: Mi tarjeta muestra la tarjeta enviada", async () => {
  await page.goto("/paciente");
  await page.getByRole("link", { name: /^Mi tarjeta/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: cardTitle })).toBeVisible();
  await expect(page.getByText("Esta tarjeta la aprobó Marisol.")).toBeVisible();
});

test("8. /proveedores lista médicos", async () => {
  await page.goto("/proveedores");
  await expect(page.getByText(/Mostrando [1-9]\d* de \d+ profesionales/)).toBeVisible();
});
