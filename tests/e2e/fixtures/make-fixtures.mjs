// Renders the three synthetic demo photos used by tests/e2e/demo-path.spec.ts.
// Everything on them is fictional: doctors, pharmacy, plan and patient.
// Run: node tests/e2e/fixtures/make-fixtures.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));

const PAGES = {
  "rx-handwritten.jpg": `
    <div style="font-family:'Bradley Hand','Comic Sans MS',cursive;font-size:30px;color:#1d2a6b;transform:rotate(-2deg)">
      <p style="font-family:Georgia,serif;font-size:22px;color:#333">Dr. Ramón Feliciano (ficticio) · Medicina de Familia · Adjuntas, PR</p>
      <p>Paciente: Carmen Rivera</p>
      <p style="font-size:44px">Rx Losartan 50mg</p>
      <p style="filter:blur(2.5px)">1 tab po qd am c/ agua</p>
      <p>#30</p>
      <p>9/10/26 &nbsp;&nbsp; Dr. R. Feliciano</p>
      <p style="font-family:Georgia,serif;font-size:16px;color:#a00">SINTÉTICO · DOCUMENTO DE DEMOSTRACIÓN</p>
    </div>`,
  "rx-label.jpg": `
    <div style="font-family:Menlo,monospace;font-size:24px;border:3px solid #000;padding:20px;width:720px">
      <p style="font-size:30px;font-weight:bold">FARMACIA COCOTERO (FICTICIA)</p>
      <p>RX# 000123 &nbsp;&nbsp; 10/09/2026</p>
      <p>CARMEN RIVERA</p>
      <p style="font-weight:bold">LOSARTAN POTASSIUM 50 MG</p>
      <p>TOME 1 TABLETA POR BOCA UNA VEZ AL DIA</p>
      <p>QTY: 30 &nbsp;&nbsp; REFILLS: 2</p>
      <p>DR R FELICIANO</p>
      <p style="color:#a00">SINTETICO · ETIQUETA DE DEMOSTRACION</p>
    </div>`,
  "referido.jpg": `
    <div style="font-family:Georgia,serif;font-size:24px;border:2px solid #000;padding:24px;width:720px">
      <p style="font-size:30px;font-weight:bold">REFERIDO</p>
      <p>PLAN DE SALUD ISLA (FICTICIO)</p>
      <p>Paciente: Carmen Rivera</p>
      <p>Especialidad: CARDIOLOGIA</p>
      <p>Fecha: 09/oct/2026</p>
      <p>Médico que refiere: Dra. A. Lugo (ficticia)</p>
      <p style="color:#a00">SINTÉTICO · DOCUMENTO DE DEMOSTRACIÓN</p>
    </div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
for (const [name, body] of Object.entries(PAGES)) {
  await page.setContent(`<body style="margin:0;padding:30px;background:#f6f1e4">${body}</body>`);
  await page.screenshot({ path: `${dir}/${name}`, type: "jpeg", quality: 85 });
}
await browser.close();
