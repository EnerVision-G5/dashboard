import { describe, expect, it } from "vitest";
import { buildChartSeries, countMissingReadings } from "./series";
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
