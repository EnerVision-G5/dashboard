import { describe, expect, it } from "vitest";
import { buildDataHealth, formatAge, formatRatio } from "./dataHealth";
import { makeSensorHealth, makeSiteIndicators } from "../test/doubles";

const LABELS: Record<string, string> = {
  "SITE-001": "Usine Nantes Nord",
  "SITE-002": "Entrepôt Rezé",
};
const labelOf = (siteId: string) => LABELS[siteId] ?? siteId;

describe("formatAge", () => {
  it("garde les secondes sous la minute", () => {
    expect(formatAge(45)).toBe("45 s");
  });

  it("passe en minutes puis en heures", () => {
    expect(formatAge(300)).toBe("5 min");
    expect(formatAge(3600)).toBe("1 h");
    expect(formatAge(4500)).toBe("1 h 15 min");
  });

  it("ne rend jamais un âge négatif", () => {
    expect(formatAge(-10)).toBe("0 s");
  });
});

describe("formatRatio", () => {
  it("arrondit à l'entier", () => {
    expect(formatRatio(0.126)).toBe("13 %");
    expect(formatRatio(0)).toBe("0 %");
  });
});

describe("buildDataHealth", () => {
  it("ne signale rien sur un parc sain", () => {
    const health = buildDataHealth({
      indicators: [makeSiteIndicators(), makeSiteIndicators({ site_id: "SITE-002" })],
      sensors: [makeSensorHealth()],
      labelOf,
    });

    expect(health.level).toBe("ok");
    expect(health.findings).toEqual([]);
    expect(health.sitesChecked).toBe(2);
    expect(health.generatedAt).toBe("2026-09-02T12:00:00Z");
  });

  it("signale un retard d'ingestion avec l'âge et le seuil servis par l'API", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          ingestion: {
            last_measure_at: "2026-09-02T10:00:00Z",
            last_ingested_at: "2026-09-02T10:00:30Z",
            measure_age_seconds: 7200,
            ingestion_lag_seconds: 30,
            is_stale: true,
            stale_threshold_seconds: 300,
            collector: null,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.level).toBe("degraded");
    expect(health.findings).toHaveLength(1);
    expect(health.findings[0].kind).toBe("stale");
    expect(health.findings[0].message).toBe(
      "Usine Nantes Nord : dernière mesure il y a 2 h, au-delà du seuil de 5 min.",
    );
  });

  it("distingue un site muet d'un site en retard, et le tient pour critique", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          site_id: "SITE-002",
          ingestion: {
            last_measure_at: null,
            last_ingested_at: null,
            measure_age_seconds: null,
            ingestion_lag_seconds: null,
            is_stale: true,
            stale_threshold_seconds: 300,
            collector: null,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.level).toBe("critical");
    expect(health.findings[0].kind).toBe("no_data");
    expect(health.findings[0].message).toBe("Entrepôt Rezé n'a aucune mesure sur la fenêtre.");
  });

  it("reprend le seuil de qualité de l'API sans en choisir un", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          quality: {
            window_start: "2026-09-01T12:00:00Z",
            window_end: "2026-09-02T12:00:00Z",
            total: 1440,
            qualified: 1440,
            qualified_ratio: 1,
            not_good: 300,
            degraded: 300,
            imputed: 12,
            sensor_failure: 0,
            degraded_ratio: 0.208,
            threshold: 0.15,
            exceeds_threshold: true,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.findings[0].message).toBe(
      "Usine Nantes Nord : 21 % de mesures dégradées, seuil 15 %.",
    );
  });

  it("refuse de présenter comme saine une fenêtre que l'ETL n'a pas qualifiée", () => {
    // Piège documenté au contrat : data_quality vaut good par défaut, donc une
    // fenêtre non traitée affiche 0 % de dégradation sans être propre.
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          quality: {
            window_start: "2026-09-01T12:00:00Z",
            window_end: "2026-09-02T12:00:00Z",
            total: 1440,
            qualified: 0,
            qualified_ratio: 0,
            not_good: 0,
            degraded: 0,
            imputed: 0,
            sensor_failure: 0,
            degraded_ratio: 0,
            threshold: 0.1,
            exceeds_threshold: false,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.level).toBe("degraded");
    expect(health.findings[0].kind).toBe("unqualified");
    expect(health.findings[0].message).toContain("aucune des 1440 mesures");
  });

  it("compte les mesures attribuées à une panne de capteur", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          quality: {
            ...makeSiteIndicators().quality,
            sensor_failure: 42,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.findings[0].kind).toBe("sensor_failure");
    expect(health.findings[0].message).toContain("42 mesure(s)");
  });

  it("tient la perte réseau pour critique et nomme le capteur tombé", () => {
    const health = buildDataHealth({
      indicators: [makeSiteIndicators()],
      sensors: [
        makeSensorHealth({ capteur: "consumption", statut: "ok", overall: "critical" }),
        makeSensorHealth({
          capteur: "network",
          statut: "failing",
          overall: "critical",
          failing_until: "2026-09-02T14:00:00Z",
        }),
      ],
      labelOf,
    });

    expect(health.level).toBe("critical");
    expect(health.findings.map((finding) => finding.kind)).toEqual([
      "network",
      "sensor_failure",
    ]);
    expect(health.findings[1].message).toContain("capteur réseau en panne");
    expect(health.findings[1].message).toContain("rétablissement annoncé");
  });

  it("dit qu'aucune date de rétablissement n'est annoncée plutôt que d'en inventer", () => {
    const health = buildDataHealth({
      indicators: [],
      sensors: [
        makeSensorHealth({ capteur: "temperature", statut: "failing", overall: "degraded" }),
      ],
      labelOf,
    });

    expect(health.level).toBe("degraded");
    expect(health.findings[0].message).toBe(
      "Usine Nantes Nord : capteur température en panne, sans date de rétablissement annoncée.",
    );
  });

  it("place les constats critiques avant les constats dégradés", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          site_id: "SITE-001",
          quality: { ...makeSiteIndicators().quality, sensor_failure: 3 },
        }),
        makeSiteIndicators({
          site_id: "SITE-002",
          ingestion: {
            last_measure_at: null,
            last_ingested_at: null,
            measure_age_seconds: null,
            ingestion_lag_seconds: null,
            is_stale: true,
            stale_threshold_seconds: 300,
            collector: null,
          },
        }),
      ],
      sensors: [],
      labelOf,
    });

    expect(health.findings[0].level).toBe("critical");
    expect(health.findings[0].siteId).toBe("SITE-002");
    expect(health.findings[1].level).toBe("degraded");
  });

  it("retombe sur l'identifiant du site quand aucun nom n'est connu", () => {
    const health = buildDataHealth({
      indicators: [
        makeSiteIndicators({
          site_id: "SITE-999",
          quality: { ...makeSiteIndicators().quality, sensor_failure: 1 },
        }),
      ],
      sensors: [],
    });

    expect(health.findings[0].message).toContain("SITE-999");
  });

  it("ne prétend rien sur un parc vide", () => {
    const health = buildDataHealth({ indicators: [], sensors: [] });

    expect(health.level).toBe("ok");
    expect(health.sitesChecked).toBe(0);
    expect(health.generatedAt).toBeNull();
  });
});
