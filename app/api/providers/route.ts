import { NextResponse } from "next/server";
import { catalog, providers as localProviders } from "@/lib/providers/catalog";
import { fetchMedSeekPueblos, fetchMedSeekSpecialties, fetchMedSeekProfile, searchMedSeek } from "@/lib/providers/medseek";
import { medseekAttempts, narrowToQuery } from "@/lib/providers/query";
import { searchProviders } from "@/lib/providers/search";

export const maxDuration = 10;

/**
 * MedSeek PR is a third party directory and asks to be credited wherever its
 * data is shown, so the credit lives here rather than in each caller and
 * cannot drift from what the API actually serves.
 */
export const MEDSEEK_ATTRIBUTION = "Datos provistos por MedSeek · medseekpr.com";

/**
 * GET /api/providers
 * Query params:
 *   specialty | especialidad: Specialty filter (e.g. "CARDIOLOGIA")
 *   municipio | pueblo: Town filter (e.g. "PONCE", "SAN JUAN")
 *   nombre: First name query
 *   apellidos: Last name query
 *   source: "medseek" | "local" | "auto" (default: "auto")
 *   meta: "options" -> returns available pueblos and specialties
 *   profile: "1" -> returns verified profile details for a doctor
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const meta = url.searchParams.get("meta");

  if (meta === "options") {
    try {
      const [pueblos, specialties] = await Promise.allSettled([
        fetchMedSeekPueblos(3500),
        fetchMedSeekSpecialties(3500),
      ]);

      const medseekPueblos = pueblos.status === "fulfilled" ? pueblos.value : [];
      const medseekSpecialties = specialties.status === "fulfilled" ? specialties.value : [];

      return NextResponse.json({
        ok: true,
        source: medseekPueblos.length > 0 ? "medseekpr.com" : "local",
        pueblos: medseekPueblos.length > 0 ? medseekPueblos : Object.keys(catalog.municipio_counts),
        specialties: medseekSpecialties,
      });
    } catch {
      return NextResponse.json({
        ok: true,
        source: "local",
        pueblos: Object.keys(catalog.municipio_counts),
        specialties: [],
      });
    }
  }

  const profile = url.searchParams.get("profile");
  if (profile) {
    const nombre = url.searchParams.get("nombre") || "";
    const apellidos = url.searchParams.get("apellidos") || "";
    if (!nombre && !apellidos) {
      return NextResponse.json({ ok: false, error: "Missing nombre or apellidos" }, { status: 400 });
    }
    const prof = await fetchMedSeekProfile(nombre, apellidos);
    if (!prof) {
      return NextResponse.json({ ok: false, error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, source: "medseekpr.com", profile: prof });
  }

  const specialty = url.searchParams.get("specialty") || url.searchParams.get("especialidad") || "";
  const municipio = url.searchParams.get("municipio") || url.searchParams.get("pueblo") || "";
  const nombre = url.searchParams.get("nombre") || "";
  const apellidos = url.searchParams.get("apellidos") || "";
  const preferredSource = url.searchParams.get("source") || "auto";

  /**
   * What the frozen catalog should match on. The caregiver types one string,
   * so the whole string is the filter: it catches both "Gerardo" and
   * "Alayon" without guessing which part of the name it was.
   */
  const nameQuery = () => (nombre || url.searchParams.get("q") || apellidos || "").trim();

  // If local requested explicitly, filter the frozen catalog directly
  if (preferredSource === "local") {
    const results = searchProviders(localProviders, { specialty, municipio, name: nameQuery() });
    return NextResponse.json({
      ok: true,
      source: "local-orcps",
      attribution: catalog.attribution,
      count: results.length,
      providers: results,
    });
  }

  // Try live MedSeek PR search first
  try {
    const rawQuery = (url.searchParams.get("q") || nombre || "").trim();

    for (const attempt of medseekAttempts({ raw: rawQuery, nombre, apellidos })) {
      const medseekResults = await searchMedSeek(
        {
          especialidad: specialty || null,
          pueblo: municipio || null,
          ...attempt,
        },
        { timeoutMs: 3500 }
      );

      // Upstream ignores a filter it cannot match and returns the whole
      // directory, so a non-empty response is not proof the query matched.
      const narrowed = narrowToQuery(medseekResults, {
        specialty,
        municipio,
        raw: rawQuery,
        nombre,
        apellidos,
      });

      if (narrowed.length > 0) {
        return NextResponse.json({
          ok: true,
          source: "medseekpr.com",
          attribution: MEDSEEK_ATTRIBUTION,
          count: narrowed.length,
          providers: narrowed,
        });
      }
    }
  } catch (err) {
    console.warn("MedSeek PR live search error, falling back to local catalog:", err);
  }

  // Fallback to local catalog when MedSeek is empty or unreachable
  const localResults = searchProviders(localProviders, { specialty, municipio, name: nameQuery() });
  return NextResponse.json({
    ok: true,
    source: "local-orcps",
    attribution: catalog.attribution,
    count: localResults.length,
    providers: localResults,
  });
}
