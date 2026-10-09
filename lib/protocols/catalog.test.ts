import { describe, expect, it } from "vitest";
import { MEDICATION_CAUTION, getAllProtocols, getProtocolById, searchProtocols, simulatedCount } from "./catalog";

describe("Protocol catalog", () => {
  it("loads all three seed protocols successfully", () => {
    const list = getAllProtocols();
    expect(list.length).toBe(3);
  });

  it("labels the Humacao endoscopy example as SIMULADO", () => {
    const p = getProtocolById("humacao-endoscopia");
    expect(p).toBeDefined();
    expect(p?.facility).toBe("Centro de gastroenterología (ejemplo)");
    expect(p?.is_simulated).toBe(true);
    expect(p?.source_url).toBeNull();
  });

  it("marks Menonita MRI as simulated illustrative protocol", () => {
    const p = getProtocolById("menonita-mri-contraste");
    expect(p).toBeDefined();
    expect(p?.is_simulated).toBe(true);
    expect(p?.source_url).toBeNull();
    expect(p?.badge_label).toContain("SIMULADO");
  });

  it("searches protocols by procedure keyword", () => {
    const results = searchProtocols("endoscopía");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe("humacao-endoscopia");
  });
});

/**
 * Marley QA (production 6c89d18): the protocol cards were never on the page,
 * so the two illustrative examples could be read as real facility policy.
 * A card is only honest if the data says so, so the counts are read, not typed.
 */
describe("what the page may claim about each card", () => {
  it("counts two of the three cards as simulated examples", () => {
    expect(simulatedCount()).toBe(2);
    expect(simulatedCount(getAllProtocols().filter((p) => p.id === "humacao-endoscopia"))).toBe(1);
    expect(simulatedCount([])).toBe(0);
  });

  it("gives every simulated card a badge label and a notice of its own", () => {
    const simulated = getAllProtocols().filter((p) => p.is_simulated);
    expect(simulated.map((p) => p.id).sort()).toEqual(["humacao-endoscopia", "menonita-mri-contraste"]);
    for (const p of simulated) {
      expect(p.badge_label).toContain("SIMULADO");
      expect(p.simulated_notice).toBeTruthy();
      expect(p.source_url).toBeNull();
    }
    expect(simulatedCount()).toBe(simulated.length);
  });

  it("keeps the one published card sourced, and never labels it simulated", () => {
    const published = getAllProtocols().filter((p) => !p.is_simulated);
    expect(published).toHaveLength(1);
    expect(published[0].source_url).toBeTruthy();
    expect(published[0].badge_label).not.toContain("SIMULADO");
  });

  it("carries the medicine caution, because at least one simulated card tells her to hold a medicine", () => {
    const simulated = getAllProtocols().filter((p) => p.simulated_notice);
    expect(simulated.length).toBeGreaterThan(0);
    expect(simulated.some((p) => p.requirements.some((r) => /suspender|anticoagulante|aspirina/i.test(r.description)))).toBe(
      true,
    );
    expect(MEDICATION_CAUTION).toMatch(/médico/);
    expect(MEDICATION_CAUTION).toMatch(/no cambie|ninguna medicina/i);
  });
});
