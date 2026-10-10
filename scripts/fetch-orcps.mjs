#!/usr/bin/env node
/**
 * Rebuilds data/providers/*.json from the public ORCPS API (Junta de
 * Licenciamiento y Disciplina Médica, Departamento de Salud de Puerto Rico) and
 * joins practice phones from the CMS NPPES registry.
 *
 * Behaviour follows research/provider-scout.md in the war room repo:
 *   - GET only. No login, no captcha, no write endpoint.
 *   - Named user agent, at most one request per second per host.
 *   - `totalRecords` and `totalPages` read 0 at any pageSize other than 10, so
 *     pagination stops on a short page instead of on the counters.
 *   - Rows are not deduplicated by the API, so dedupe happens here on
 *     `licenseNumber`.
 *   - `licenseStatus` and `lock` are integers and booleans. Only Activo rows
 *     ship, and a row with a restriction is dropped rather than flagged.
 *   - Names and certifications arrive HTML entity encoded (`ABELARDO
 *     QUI&#209;ONES MARTINEZ`), so they are unescaped here.
 *   - TLS: the host presents a valid DigiCert leaf and also sends a self
 *     signed root. This script verifies with the trust store Node already uses,
 *     the way curl and a browser do. It never disables verification and never
 *     pins a certificate. If verification ever fails the run stops, and the
 *     fix is `NODE_EXTRA_CA_CERTS=<digicert root pem> node scripts/fetch-orcps.mjs`.
 *
 * Usage: node scripts/fetch-orcps.mjs
 */

import { writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORCPS = "https://orcpsws.salud.pr.gov";
const VERIFY_URL = "https://orcps.salud.pr.gov/mbps/verificacion";
const NPPES = "https://npiregistry.cms.hhs.gov/api/";
const USER_AGENT = "QuidaProviderFetch/0.2 (Qwida, Caribbean AI Summit hackathon)";
const ATTRIBUTION =
  "Datos públicos de la Junta de Licenciamiento y Disciplina Médica (ORCPS) y CMS NPPES";

/** One request per second, plus a little margin. */
const DELAY_MS = 1150;
const TIMEOUT_MS = 60_000;
const PROFESSION_PHYSICIAN = 78;
const STATUS_ACTIVE = 1;
const PAGE_SIZE = 200;
/** Safety net: the API gives no trustworthy total, so stop instead of looping. */
const MAX_PAGES_PER_MUNICIPIO = 60;
const NPPES_LIMIT = 200;
const NPPES_MAX_SKIP = 2000;
/** The brief: at most this many records per specialty per municipality. */
const CAP_PER_SPECIALTY_MUNICIPIO = 40;

const MUNICIPIOS = ["PONCE", "ADJUNTAS", "UTUADO", "MANATI", "CAGUAS"];

const SPECIALTIES = [
  { value: "cardiologia", label: "Cardiología", term: "CARDIOLOGIA", nppes: "Cardiovascular Disease" },
  { value: "neurologia", label: "Neurología", term: "NEUROLOGIA", nppes: "Neurology" },
  { value: "medicina interna", label: "Medicina interna", term: "MEDICINA INTERNA", nppes: "Internal Medicine" },
  { value: "endocrinologia", label: "Endocrinología", term: "ENDOCRINOLOGIA", nppes: "Endocrinology" },
];

const NOTES = [
  "Solo licencias activas. Se descartaron los registros con restricción y los que no estaban activos.",
  "El teléfono viene de NPPES, que es el dato que reporta el profesional, y puede estar desactualizado.",
  "ORCPS y NPPES no dicen si un profesional acepta pacientes nuevos ni qué planes acepta. Esos dos datos no existen en fuentes públicas y no se inventan.",
  "Datos de profesionales reales. No se incluyen direcciones personales ni datos de pacientes.",
];

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "providers");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Last request time per host, so two hosts never wait on each other. */
const lastRequestAt = new Map();

async function throttle(host) {
  const wait = (lastRequestAt.get(host) ?? 0) + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

/** The API answers 500 on the odd request. That is transient, so it is retried once. */
const MAX_ATTEMPTS = 3;

/**
 * orcpsws.salud.pr.gov takes 7 to 10 seconds to finish a TLS handshake, which
 * is longer than the 10 second connect timeout of Node's built in fetch. So
 * this uses node:https with a keep alive agent: one slow handshake per host,
 * then reused. Certificate verification stays on.
 */
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });

function request(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { agent, headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, timeout: TIMEOUT_MS },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function getJson(url) {
  const { host } = new URL(url);
  let lastProblem = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await throttle(host);
    try {
      const { status, text } = await request(url);
      if (status >= 200 && status < 300) return JSON.parse(text);
      if (status < 500) throw new Error(`HTTP ${status} en ${url}`);
      lastProblem = `HTTP ${status} en ${url}`;
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("HTTP ")) throw cause;
      const why = cause?.code ?? cause?.message ?? String(cause);
      lastProblem =
        `No se pudo leer ${url}: ${why}. Si es un fallo de certificado, este servidor envía una raíz autofirmada: reintente con NODE_EXTRA_CA_CERTS apuntando a la raíz de DigiCert.`;
    }
    if (attempt < MAX_ATTEMPTS) console.warn(`Reintentando (${attempt}/${MAX_ATTEMPTS}): ${lastProblem}`);
  }
  throw new Error(lastProblem);
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** ORCPS sends `ABELARDO QUI&#209;ONES` and `CIRUGIA Y TOR&Aacute;CICA`. */
function unescapeHtml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Accent and case insensitive comparison key: "CARDIOLOGIA" matches "Cardiología". */
const fold = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();

async function resolveMunicipios() {
  const catalog = await getJson(`${ORCPS}/Catalog/PlaceWork`);
  const byName = new Map(catalog.map((row) => [fold(row.citiesDescription), row.citiesCode]));
  return MUNICIPIOS.map((name) => {
    const code = byName.get(fold(name));
    if (code === undefined) throw new Error(`ORCPS no conoce el municipio ${name}.`);
    return { name, code };
  });
}

/** Every active physician of a municipio, one page at a time. */
async function fetchMunicipioPhysicians(citiesCode) {
  const rows = [];
  for (let page = 0; page < MAX_PAGES_PER_MUNICIPIO; page += 1) {
    const query = new URLSearchParams({
      firstName: "",
      surName1: "",
      surName2: "",
      licenseNumber: "0",
      professionCode: String(PROFESSION_PHYSICIAN),
      placeOfWork: String(citiesCode),
      statusLicense: String(STATUS_ACTIVE),
      pageNumber: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const body = await getJson(`${ORCPS}/Professionals/VerifyLicences?${query}`);
    if (body.succeeded !== true) {
      throw new Error(`ORCPS respondió sin éxito para el código ${citiesCode}: ${JSON.stringify(body.errors ?? body.message)}`);
    }
    const data = Array.isArray(body.data) ? body.data : [];
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
  throw new Error(`ORCPS devolvió ${MAX_PAGES_PER_MUNICIPIO} páginas llenas para el código ${citiesCode}. Se corta aquí para no seguir paginando a ciegas.`);
}

/** NPPES licenses arrive as "PR09656" or "9656". ORCPS sends them as numbers. */
const licenseKey = (value) => String(value).trim().toUpperCase().replace(/^PR/, "").replace(/^0+/, "");

function readPhone(result) {
  const addresses = Array.isArray(result.addresses) ? result.addresses : [];
  const location =
    addresses.find((address) => address.address_purpose === "LOCATION" && address.telephone_number) ??
    addresses.find((address) => address.telephone_number);
  const digits = String(location?.telephone_number ?? "").replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  return `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}`;
}

/**
 * Practice phones keyed by normalized license number. NPPES caps every query at
 * 200 results, so each taxonomy pages with `skip` until a short page comes back.
 * The query is by taxonomy and state, not by city: NPPES matches its `city`
 * against the practice address exactly, and a doctor whose address reads
 * "SAN JUAN PR" would otherwise be missed.
 */
async function fetchPhones() {
  const phones = new Map();
  for (const specialty of SPECIALTIES) {
    for (let skip = 0; skip < NPPES_MAX_SKIP; skip += NPPES_LIMIT) {
      const query = new URLSearchParams({
        version: "2.1",
        taxonomy_description: specialty.nppes,
        state: "PR",
        limit: String(NPPES_LIMIT),
        skip: String(skip),
      });
      const body = await getJson(`${NPPES}?${query}`);
      const results = Array.isArray(body.results) ? body.results : [];
      for (const result of results) {
        const phone = readPhone(result);
        if (!phone) continue;
        for (const taxonomy of Array.isArray(result.taxonomies) ? result.taxonomies : []) {
          if (taxonomy.state !== "PR" || !taxonomy.license) continue;
          const key = licenseKey(taxonomy.license);
          if (key && !phones.has(key)) phones.set(key, phone);
        }
      }
      if (results.length < NPPES_LIMIT) break;
    }
    console.log(`NPPES ${specialty.value}: ${phones.size} licencias con teléfono`);
  }
  return phones;
}

async function main() {
  const fetchedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const municipios = await resolveMunicipios();
  console.log(`Municipios: ${municipios.map((m) => `${m.name} (${m.code})`).join(", ")}`);

  const phones = await fetchPhones();

  const byMunicipio = new Map();
  for (const municipio of municipios) {
    const rows = await fetchMunicipioPhysicians(municipio.code);
    const unique = new Map();
    let duplicateRows = 0;
    let restricted = 0;
    let notActive = 0;
    for (const row of rows) {
      const license = String(row.licenseNumber ?? "").trim();
      const name = unescapeHtml(String(row.fullName ?? "")).trim();
      const specialty = unescapeHtml(String(row.specialty ?? "")).trim();
      if (!license || !name || !specialty) continue;
      if (row.licenseStatus !== STATUS_ACTIVE) {
        notActive += 1;
        continue;
      }
      if (row.lock === true) {
        restricted += 1;
        continue;
      }
      if (unique.has(license)) {
        duplicateRows += 1;
        continue;
      }
      unique.set(license, {
        name,
        specialty,
        municipio: String(row.placeOfWork ?? municipio.name).trim() || municipio.name,
        license_number: license,
        license_status: "ACTIVO",
        phone: phones.get(licenseKey(license)) ?? null,
        source_url: VERIFY_URL,
        fetched_at: fetchedAt,
      });
    }
    byMunicipio.set(municipio.name, { records: [...unique.values()], duplicateRows, restricted, notActive });
    console.log(
      `${municipio.name}: ${rows.length} filas, ${unique.size} licencias únicas, ${restricted} con restricción, ${notActive} no activas, ${duplicateRows} repetidas`,
    );
  }

  for (const specialty of SPECIALTIES) {
    const records = [];
    const municipioCounts = {};
    const truncated = [];
    for (const municipio of municipios) {
      const found = byMunicipio
        .get(municipio.name)
        .records.filter((record) => fold(record.specialty).includes(fold(specialty.term)));
      const kept = found.slice(0, CAP_PER_SPECIALTY_MUNICIPIO);
      municipioCounts[municipio.name] = kept.length;
      if (found.length > kept.length) {
        truncated.push({ municipio: municipio.name, found: found.length, published: kept.length });
      }
      records.push(...kept);
    }
    records.sort(
      (a, b) =>
        a.municipio.localeCompare(b.municipio) || a.name.localeCompare(b.name) || a.license_number.localeCompare(b.license_number),
    );

    const dropped = municipios.reduce(
      (total, municipio) => {
        const stats = byMunicipio.get(municipio.name);
        return {
          restricted: total.restricted + stats.restricted,
          not_active: total.not_active + stats.notActive,
          duplicate_rows: total.duplicate_rows + stats.duplicateRows,
        };
      },
      { restricted: 0, not_active: 0, duplicate_rows: 0 },
    );

    const file = {
      specialty: specialty.value,
      specialty_label: specialty.label,
      attribution: ATTRIBUTION,
      source_url: VERIFY_URL,
      fetched_at: fetchedAt,
      record_count: records.length,
      municipio_counts: municipioCounts,
      phone_count: records.filter((record) => record.phone !== null).length,
      truncated,
      dropped,
      notes: NOTES,
      records,
    };
    const target = path.join(OUT_DIR, `${specialty.value.replace(/ /g, "-")}.json`);
    await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
    console.log(
      `${specialty.value}: ${records.length} registros, ${file.phone_count} con teléfono, por municipio ${JSON.stringify(municipioCounts)}${truncated.length ? `, recortado ${JSON.stringify(truncated)}` : ""}`,
    );
  }

  console.log(`Escrito en ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});