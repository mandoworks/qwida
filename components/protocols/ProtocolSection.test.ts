import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProveedoresPage from "@/app/proveedores/page";
import { getAllProtocols } from "@/lib/protocols/catalog";
import { ProtocolSection } from "./ProtocolSection";

/**
 * Marley QA (production 6c89d18) asked for the protocol cards on /proveedores,
 * with the SIMULADO badge and the simulated notice shown exactly as the data
 * has them. Markup is rendered here because a card that is merely present in
 * the catalog says nothing about what the caregiver ends up reading.
 */
const markup = (node: ReturnType<typeof createElement>) => renderToStaticMarkup(node);

describe("ProtocolSection", () => {
  const html = markup(createElement(ProtocolSection));

  it("shows every card in the catalog", () => {
    for (const protocol of getAllProtocols()) {
      expect(html).toContain(protocol.title);
    }
  });

  it("shows a SIMULADO badge on every simulated card, and only on those", () => {
    const simulated = getAllProtocols().filter((p) => p.is_simulated);
    expect(simulated).toHaveLength(2);
    for (const p of simulated) expect(html).toContain(p.title);
    const badges = html.match(/title="Función simulada, no está corriendo de verdad"/g) ?? [];
    expect(badges).toHaveLength(simulated.length);
  });

  it("prints each simulated notice verbatim, and its badge label", () => {
    for (const p of getAllProtocols().filter((x) => x.simulated_notice)) {
      expect(html).toContain(p.simulated_notice as string);
      expect(html).toContain(p.badge_label);
    }
  });

  it("never presents an illustrative example as a published facility rule", () => {
    const published = getAllProtocols().filter((p) => !p.is_simulated);
    expect(html).toContain(published[0].badge_label);
    expect(html).not.toContain("GUÍA GENERAL (SIMULADO)");
  });

  it("counts the simulated cards on screen, from the data", () => {
    expect(html).toContain("2 de 3");
  });

  it("pairs the medicine caution with the card that tells her to hold a medicine", () => {
    expect(html).toContain("No empiece, no suspenda y no cambie ninguna medicina");
  });
});

describe("/proveedores", () => {
  const page = markup(createElement(ProveedoresPage));

  it("puts the section under the agreed heading", () => {
    expect(page).toContain("Antes de su cita: no pierda el viaje");
    expect(page).toContain('aria-labelledby="antes-de-su-cita"');
  });

  it("renders the protocol cards on the page", () => {
    for (const p of getAllProtocols().filter((x) => x.simulated_notice)) {
      expect(page).toContain(p.simulated_notice as string);
    }
  });

  it("keeps the filter controls and their per option counts", () => {
    expect(page).toContain('id="filtro-especialidad"');
    expect(page).toContain('id="filtro-municipio"');
    expect(page).toContain("Cardiología (15)");
    expect(page).toContain("Ponce (15)");
    expect(page).toContain("Cardiología intervencional (3)");
  });
});