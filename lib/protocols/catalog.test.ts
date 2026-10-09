import { describe, expect, it } from "vitest";
import { getAllProtocols, getProtocolById, searchProtocols } from "./catalog";

describe("Protocol catalog", () => {
  it("loads all three seed protocols successfully", () => {
    const list = getAllProtocols();
    expect(list.length).toBe(3);
  });

  it("finds Humacao verified endoscopy protocol", () => {
    const p = getProtocolById("humacao-endoscopia");
    expect(p).toBeDefined();
    expect(p?.facility).toBe("Instituto Gastroenterológico de Humacao");
    expect(p?.is_simulated).toBe(false);
    expect(p?.source_url).toContain("institutogastropr.com");
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
