import { describe, expect, it } from "vitest";
import { medseekAttempts, narrowToQuery } from "./query";

type Row = { name: string; specialty: string; municipio: string };

const rows: Row[] = [
  { name: "GERARDO ALAYON ANTA", specialty: "CARDIOLOGIA", municipio: "PONCE" },
  { name: "GERARDO TOSCA", specialty: "PEDIATRIA", municipio: "SAN JUAN" },
  { name: "JORGE E RUIZ DIAZ", specialty: "MEDICINA INTERNA", municipio: "CAGUAS" },
  { name: "MARIA DE LOS SANTOS PEREZ", specialty: "CARDIOLOGIA", municipio: "MAYAGUEZ" },
];

describe("medseekAttempts", () => {
  it("splits a full name into first and last, then retries the whole string with q", () => {
    const attempts = medseekAttempts({ raw: "Gerardo Alayon" });

    expect(attempts[0]).toEqual({ nombre: "Gerardo", apellidos: "Alayon" });
    expect(attempts).toContainEqual({ q: "Gerardo Alayon" });
  });

  it("tries a single word as a broad q before narrowing it to a first name", () => {
    expect(medseekAttempts({ raw: "Alayon" })).toEqual([{ q: "Alayon" }, { nombre: "Alayon" }]);
  });

  it("keeps explicit nombre and apellidos ahead of the raw string", () => {
    const attempts = medseekAttempts({ raw: "Ruiz", nombre: "Jorge", apellidos: "Ruiz Diaz" });
    expect(attempts[0]).toEqual({ nombre: "Jorge", apellidos: "Ruiz Diaz" });
  });

  it("asks for the whole directory only when no name was typed", () => {
    expect(medseekAttempts({})).toEqual([{}]);
    expect(medseekAttempts({ raw: "" })).toEqual([{}]);
  });
});

describe("narrowToQuery", () => {
  it("drops rows that do not contain what the caregiver typed", () => {
    expect(narrowToQuery(rows, { raw: "Alayon" }).map((r) => r.name)).toEqual(["GERARDO ALAYON ANTA"]);
  });

  it("is accent and case insensitive", () => {
    expect(narrowToQuery(rows, { raw: "maria de los santos" }).map((r) => r.name)).toEqual([
      "MARIA DE LOS SANTOS PEREZ",
    ]);
  });

  it("keeps rows when the upstream result was not filtered at all", () => {
    // Upstream returned everything for q=Alayon. Only one row actually matches.
    expect(narrowToQuery(rows, { raw: "Alayon" })).toHaveLength(1);
  });

  it("filters by specialty and municipio together with the name", () => {
    expect(
      narrowToQuery(rows, { raw: "Gerardo", specialty: "PEDIATRIA", municipio: "SAN JUAN" }).map((r) => r.name),
    ).toEqual(["GERARDO TOSCA"]);
  });

  it("returns everything when only a town was chosen", () => {
    expect(narrowToQuery(rows, { municipio: "CAGUAS" }).map((r) => r.name)).toEqual(["JORGE E RUIZ DIAZ"]);
  });

  it("returns an empty list when nothing matches, rather than the full directory", () => {
    expect(narrowToQuery(rows, { raw: "Nobody Here" })).toEqual([]);
  });
});