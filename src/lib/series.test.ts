import { describe, expect, it } from "vitest";
import {
  UNSPECIFIED_EXCLUSION_REASON,
  buildChartSeries,
  countByQuality,
  countMissingReadings,
  summarizeExclusions,
} from "./series";
import { makePredictionPoint, makeReading } from "../test/doubles";

describe("buildChartSeries", () => {
  it("trie les points par horodatage croissant", () => {
    const points = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-02T02:00:00Z", consumption_kw: 3 }),
        makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 1 }),
        makeReading({ timestamp: "2026-09-02T01:00:00Z", consumption_kw: 2 }),
      ],
      [],
    );

    expect(points.map((point) => point.actualKw)).toEqual([1, 2, 3]);
    expect(points[0].timestamp).toBe(Date.parse("2026-09-02T00:00:00Z"));
  });

  it("conserve les consommations nulles au lieu de les combler", () => {
    const points = buildChartSeries(
      [
        makeReading({
          timestamp: "2026-09-02T00:00:00Z",
          consumption_kw: null,
          consumption_kw_imputed: 118,
          data_quality: "degraded",
          imputation_method: "locf",
          null_reasons: ["sensor_offline"],
        }),
      ],
      [],
    );

    expect(points[0].actualKw).toBeNull();
    expect(points[0].imputedKw).toBe(118);
    expect(points[0].dataQuality).toBe("degraded");
    expect(points[0].imputationMethod).toBe("locf");
  });

  it("ne fabrique aucun point de jonction entre mesures et prédiction", () => {
    const points = buildChartSeries(
      [makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 100 })],
      [makePredictionPoint({ timestamp: "2026-09-02T01:00:00Z", predicted_consumption_kw: 110 })],
    );

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ actualKw: 100, predictedKw: null });
    expect(points[1]).toMatchObject({ actualKw: null, predictedKw: 110 });
  });

  it("fusionne mesure et prédiction sur un horodatage identique", () => {
    const points = buildChartSeries(
      [makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 100 })],
      [
        makePredictionPoint({
          timestamp: "2026-09-02T00:00:00Z",
          predicted_consumption_kw: 105,
          lower_bound_kw: 95,
          upper_bound_kw: 115,
        }),
      ],
    );

    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      actualKw: 100,
      predictedKw: 105,
      lowerBoundKw: 95,
      upperBoundKw: 115,
    });
  });

  it("ignore un horodatage illisible plutôt que de produire un NaN", () => {
    const points = buildChartSeries([makeReading({ timestamp: "pas-une-date" })], []);

    expect(points).toEqual([]);
  });
});

describe("countMissingReadings", () => {
  it("compte les mesures dont la consommation réelle manque", () => {
    const points = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: null }),
        makeReading({ timestamp: "2026-09-02T00:01:00Z", consumption_kw: 12 }),
      ],
      [makePredictionPoint({ timestamp: "2026-09-02T02:00:00Z" })],
    );

    // Le point purement prédit n'est pas une mesure manquante.
    expect(countMissingReadings(points)).toBe(1);
  });
});

describe("summarizeExclusions", () => {
  it("ne trouve rien quand aucune mesure n'est écartée", () => {
    const points = buildChartSeries([makeReading()], []);

    expect(summarizeExclusions(points)).toEqual({
      total: 0,
      reasons: [],
      firstAt: null,
      lastAt: null,
    });
  });

  it("compte les mesures écartées et borne leur plage", () => {
    const points = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-02T00:00:00Z" }),
        makeReading({
          timestamp: "2026-09-02T00:01:00Z",
          excluded: true,
          exclusion_reason: "temperature_sensor_failure",
        }),
        makeReading({
          timestamp: "2026-09-02T00:02:00Z",
          excluded: true,
          exclusion_reason: "temperature_sensor_failure",
        }),
      ],
      [],
    );

    const summary = summarizeExclusions(points);

    expect(summary.total).toBe(2);
    expect(summary.reasons).toEqual([
      { reason: "temperature_sensor_failure", count: 2 },
    ]);
    expect(summary.firstAt).toBe("2026-09-02T00:01:00Z");
    expect(summary.lastAt).toBe("2026-09-02T00:02:00Z");
  });

  it("classe les motifs du plus fréquent au moins fréquent", () => {
    const points = buildChartSeries(
      [
        makeReading({
          timestamp: "2026-09-02T00:00:00Z",
          excluded: true,
          exclusion_reason: "rare",
        }),
        makeReading({
          timestamp: "2026-09-02T00:01:00Z",
          excluded: true,
          exclusion_reason: "fréquent",
        }),
        makeReading({
          timestamp: "2026-09-02T00:02:00Z",
          excluded: true,
          exclusion_reason: "fréquent",
        }),
      ],
      [],
    );

    expect(summarizeExclusions(points).reasons.map((entry) => entry.reason)).toEqual([
      "fréquent",
      "rare",
    ]);
  });

  it("nomme le motif manquant plutôt que de laisser un total inexpliqué", () => {
    const points = buildChartSeries(
      [makeReading({ excluded: true, exclusion_reason: null })],
      [],
    );

    expect(summarizeExclusions(points).reasons).toEqual([
      { reason: UNSPECIFIED_EXCLUSION_REASON, count: 1 },
    ]);
  });

  it("transporte l'exclusion jusqu'au point de la série, sans masquer la mesure", () => {
    const points = buildChartSeries(
      [
        makeReading({
          consumption_kw: 118,
          excluded: true,
          exclusion_reason: "spike_simule",
        }),
      ],
      [],
    );

    // La mesure reste tracée : c'est l'exclusion qui est signalée, pas la
    // valeur qui disparaît.
    expect(points[0].actualKw).toBe(118);
    expect(points[0].excluded).toBe(true);
    expect(points[0].exclusionReason).toBe("spike_simule");
  });

  it("ne compte pas comme écarté un point purement prédit", () => {
    const points = buildChartSeries([], [makePredictionPoint()]);

    expect(points[0].excluded).toBe(false);
    expect(summarizeExclusions(points).total).toBe(0);
  });
});

describe("countByQuality", () => {
  it("rend toujours les quatre catégories du contrat, dans l'ordre", () => {
    const counts = countByQuality(buildChartSeries([makeReading()], []));

    expect(counts.map((entry) => entry.quality)).toEqual([
      "good",
      "partial",
      "degraded",
      "critical",
    ]);
  });

  it("compte les mesures par qualification", () => {
    const points = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-02T00:00:00Z", data_quality: "good" }),
        makeReading({ timestamp: "2026-09-02T00:01:00Z", data_quality: "good" }),
        makeReading({ timestamp: "2026-09-02T00:02:00Z", data_quality: "critical" }),
      ],
      [],
    );

    expect(countByQuality(points)).toEqual([
      { quality: "good", count: 2 },
      { quality: "partial", count: 0 },
      { quality: "degraded", count: 0 },
      { quality: "critical", count: 1 },
    ]);
  });

  it("ignore les points purement prédits, qui ne sont pas des mesures", () => {
    const counts = countByQuality(buildChartSeries([], [makePredictionPoint()]));

    expect(counts.every((entry) => entry.count === 0)).toBe(true);
  });

  it("rend des catégories vides sur une série vide", () => {
    expect(countByQuality([])).toHaveLength(4);
  });
});
