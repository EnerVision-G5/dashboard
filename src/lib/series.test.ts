import { describe, expect, it } from "vitest";
import {
  UNSPECIFIED_EXCLUSION_REASON,
  buildChartSeries,
  countByQuality,
  countMissingReadings,
  summarizeExclusions,
  valueDomain,
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

describe("valueDomain", () => {
  function serie(valeurs: (number | null)[]) {
    return buildChartSeries(
      valeurs.map((valeur, index) =>
        makeReading({
          timestamp: new Date(Date.UTC(2026, 8, 2, 0, index)).toISOString(),
          consumption_kw: valeur,
        }),
      ),
      [],
    );
  }

  it("cadre les bornes sur les valeurs, sans partir de zéro", () => {
    // Recharts part de zéro par défaut : sur un site oscillant entre 140 et
    // 200 kW, les quatre cinquièmes du cadre montraient un vide.
    const [min, max] = valueDomain(serie([140, 200])) as [number, number];

    expect(min).toBeGreaterThan(100);
    expect(min).toBeLessThan(140);
    expect(max).toBeGreaterThan(200);
  });

  it("laisse une marge de 15 % de l'amplitude", () => {
    const [min, max] = valueDomain(serie([100, 200])) as [number, number];

    // Amplitude de 100, donc 15 de marge de chaque côté.
    expect(min).toBe(85);
    expect(max).toBe(215);
  });

  it("tient compte de la prédiction, pas seulement des mesures", () => {
    const points = buildChartSeries(
      [makeReading({ consumption_kw: 150 })],
      [makePredictionPoint({ timestamp: "2026-09-02T01:00:00Z", predicted_consumption_kw: 400 })],
    );

    const [, max] = valueDomain(points) as [number, number];
    expect(max).toBeGreaterThan(400);
  });

  it("écarte les bornes d'une série plate, qui n'a aucune amplitude", () => {
    // Un domaine dégénéré donnerait un axe sans graduation.
    expect(valueDomain(serie([160, 160]))).toEqual([159, 161]);
  });

  it("laisse Recharts décider quand rien n'est tracé", () => {
    // Une fenêtre sans mesure ne doit pas produire un domaine inventé.
    expect(valueDomain(serie([null, null]))).toEqual(["auto", "auto"]);
    expect(valueDomain([])).toEqual(["auto", "auto"]);
  });
});

describe("buildChartSeries · toutes les grandeurs", () => {
  it("transporte les six grandeurs de la mesure", () => {
    const points = buildChartSeries(
      [
        makeReading({
          consumption_kw: 157,
          voltage_v: 399.4,
          current_a: 239.3,
          temperature_celsius: 7,
          humidity_percent: 39.1,
          power_factor: 0.95,
        }),
      ],
      [],
    );

    // Les transporter évite de recharger les mesures à chaque changement de
    // grandeur : elles sont déjà en mémoire.
    expect(points[0].values).toEqual({
      consumption: 157,
      voltage: 399.4,
      current: 239.3,
      temperature: 7,
      humidity: 39.1,
      powerFactor: 0.95,
    });
  });

  it("laisse à null une grandeur que la source n'a pas servie", () => {
    const points = buildChartSeries(
      [makeReading({ temperature_celsius: null, humidity_percent: null })],
      [],
    );

    expect(points[0].values.temperature).toBeNull();
    expect(points[0].values.humidity).toBeNull();
  });

  it("laisse toutes les grandeurs nulles sur un point purement prédit", () => {
    const points = buildChartSeries([], [makePredictionPoint()]);

    expect(Object.values(points[0].values).every((valeur) => valeur === null)).toBe(true);
  });
});

describe("valueDomain · par grandeur", () => {
  it("cadre sur la grandeur demandée, pas sur la consommation", () => {
    const points = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 150, voltage_v: 398 }),
        makeReading({ timestamp: "2026-09-02T00:01:00Z", consumption_kw: 160, voltage_v: 402 }),
      ],
      [],
    );

    const [min, max] = valueDomain(points, "voltage") as [number, number];
    expect(min).toBeGreaterThan(390);
    expect(max).toBeLessThan(410);
  });

  it("ignore la prédiction hors de la consommation", () => {
    // L'inclure écraserait une tension en volts avec des kilowatts.
    const points = buildChartSeries(
      [makeReading({ voltage_v: 400 })],
      [makePredictionPoint({ predicted_consumption_kw: 5000 })],
    );

    const [, max] = valueDomain(points, "voltage") as [number, number];
    expect(max).toBeLessThan(500);
  });
});
