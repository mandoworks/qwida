import { describe, expect, it } from "vitest";
import { formatConsulted, readable } from "./format";

describe("readable", () => {
  it("turns registry capitals into sentence case without inventing accents", () => {
    expect(readable("ADRIAN PEREZ COCHRAN")).toBe("Adrian Perez Cochran");
    expect(readable("JOSE R COUTO SEPULVEDA")).toBe("Jose R Couto Sepulveda");
    expect(readable("MEDICINA INTERNA, CARDIOLOGIA")).toBe("Medicina Interna, Cardiologia");
    expect(readable("")).toBe("");
  });

  it("is idempotent", () => {
    expect(readable(readable("HUMBERTO SIMONETTI JIMENEZ"))).toBe("Humberto Simonetti Jimenez");
  });
});

describe("formatConsulted", () => {
  it("says when the data was read, in Spanish, with the year", () => {
    expect(formatConsulted("2026-10-09T09:42:03Z")).toBe("9 de octubre de 2026");
    expect(formatConsulted("2027-01-07")).toBe("7 de enero de 2027");
  });

  it("shows the raw string rather than a broken date", () => {
    expect(formatConsulted("sin fecha")).toBe("sin fecha");
    expect(formatConsulted("2026-02-30T00:00:00Z")).toBe("2026-02-30T00:00:00Z");
  });
});
