import { describe, expect, it } from "vitest";
import { providers } from "./catalog";
import { SPECIALTIES, matchesSpecialty, municipios, normalize, searchProviders } from "./search";

const licenses = (list: { license_number: string }[]) => list.map((p) => p.license_number);

describe("normalize", () => {
  it("makes accents, case and padding irrelevant", () => {
    expect(normalize("  CARDIOLOGÍA  ")).toBe("cardiologia");
    expect(normalize("PEDIATRÍA")).toBe("pediatria");
  });
});

describe("searchProviders", () => {
  it("returns every active record when no filter is set", () => {
    expect(searchProviders(providers)).toHaveLength(providers.length);
    expect(searchProviders(providers, { specialty: "", municipio: "" })).toHaveLength(providers.length);
    expect(searchProviders(providers, { specialty: null, municipio: null })).toHaveLength(providers.length);
  });

  it("filters by specialty without accents on either side", () => {
    const cardiology = searchProviders(providers, { specialty: "Cardiología" });
    expect(cardiology).toHaveLength(providers.length);
    expect(cardiology.every((p) => matchesSpecialty(p, "cardiologia"))).toBe(true);
  });

  it("separates the interventional and pediatric certification strings", () => {
    const interventional = searchProviders(providers, { specialty: "cardiologia intervencional" });
    expect(interventional.map((p) => p.name)).toEqual([
      "ALEJANDRO J LOPEZ MAS",
      "EDGARDO BERMUDEZ MORENO",
      "RAFAEL J RIVERA BERRIOS",
    ]);
    expect(searchProviders(providers, { specialty: "cardiologia pediatrica" }).map((p) => p.name)).toEqual([
      "ANA D FINCH MATEO",
    ]);
  });

  it("filters by municipio of work, exact", () => {
    expect(searchProviders(providers, { municipio: "ponce" })).toHaveLength(providers.length);
    expect(searchProviders(providers, { municipio: "adjuntas" })).toHaveLength(0);
  });

  it("combines both filters and never mutates the input", () => {
    const before = providers.length;
    const result = searchProviders(providers, { specialty: "medicina interna", municipio: "Ponce" });
    expect(licenses(result)).toContain("11205");
    expect(result.some((p) => p.name === "ANA D FINCH MATEO")).toBe(false);
    expect(providers).toHaveLength(before);
  });
});

describe("shipped data", () => {
  it("only holds active licenses, which is what the page promises", () => {
    expect(providers.every((p) => p.license_status === "ACTIVO")).toBe(true);
  });

  it("has one license number per record and a real phone or an honest null", () => {
    const licenses = providers.map((p) => p.license_number);
    expect(new Set(licenses).size).toBe(licenses.length);
    expect(providers.filter((p) => p.phone).length).toBeGreaterThan(0);
    expect(providers.some((p) => p.phone === null)).toBe(true);
  });

  it("keeps every record reachable from a specialty option, so no card is unreachable", () => {
    for (const provider of providers) {
      expect(SPECIALTIES.some((s) => matchesSpecialty(provider, s.value))).toBe(true);
    }
  });

  it("offers only municipios that are in the data", () => {
    expect(municipios(providers)).toEqual(["PONCE"]);
  });
});
