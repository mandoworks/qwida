import { describe, expect, it } from "vitest";
import { mapMedSeekToProvider, type MedSeekRawProvider } from "./medseek";

describe("MedSeek PR mapping", () => {
  it("maps raw MedSeek provider to Quida Provider format", () => {
    const raw: MedSeekRawProvider = {
      nombre: "GERARDO",
      inicial: null,
      apellidos: "ALAYON ANTA",
      especialidad: "CARDIOLOGIA",
      npi: "1508855644",
      direccion_trabajo: "2520 AVE OBISPADO",
      pueblo: "PONCE",
      estado: "PR",
      codigo_postal: "00716-3841",
      telefono: "787-844-3153",
      data_source: "nppes_pr",
      source_id: null,
      has_scheduling: 0,
      sort_order: 5,
    };

    const provider = mapMedSeekToProvider(raw, "2026-10-09T18:00:00Z");

    expect(provider.name).toBe("GERARDO ALAYON ANTA");
    expect(provider.specialty).toBe("CARDIOLOGIA");
    expect(provider.municipio).toBe("PONCE");
    expect(provider.license_number).toBe("1508855644");
    expect(provider.license_status).toBe("ACTIVO");
    expect(provider.phone).toBe("787-844-3153");
    expect(provider.address).toBe("2520 AVE OBISPADO, PONCE, PR, 00716-3841");
    expect(provider.npi).toBe("1508855644");
    expect(provider.source_url).toContain("medseekpr.com");
  });

  it("handles missing optional fields cleanly without throwing", () => {
    const raw: MedSeekRawProvider = {
      nombre: "MARIA",
      apellidos: "SANTOS",
      especialidad: "PEDIATRIA",
      pueblo: "SAN JUAN",
      telefono: "",
    };

    const provider = mapMedSeekToProvider(raw);
    expect(provider.name).toBe("MARIA SANTOS");
    expect(provider.phone).toBeNull();
    expect(provider.license_status).toBe("ACTIVO");
  });
});
