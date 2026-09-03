import { describe, expect, it } from "vitest";
import { DEMO_PREDICTION, alignmentShiftMs, buildDemoPrediction } from "./predictionDemo";

describe("fixture de démonstration", () => {
  it("respecte la forme de PredictionOut et couvre 24 heures", () => {
    expect(DEMO_PREDICTION.points).toHaveLength(24);
    expect(DEMO_PREDICTION.model_version).toContain("demo-fixture");
    for (const point of DEMO_PREDICTION.points) {
      expect(Number.isNaN(Date.parse(point.timestamp))).toBe(false);
      expect(typeof point.predicted_consumption_kw).toBe("number");
    }
  });

  it("est déterministe : deux constructions identiques donnent le même résultat", () => {
    const reference = "2026-09-10T12:00:00.000Z";

    expect(buildDemoPrediction("SITE-001", reference)).toEqual(
      buildDemoPrediction("SITE-001", reference),
    );
  });

  it("décale la série en jours entiers pour préserver le profil jour/nuit", () => {
    const reference = "2026-09-10T12:00:00.000Z";
    const shift = alignmentShiftMs(DEMO_PREDICTION, reference);

    expect(shift % (24 * 60 * 60 * 1000)).toBe(0);

    const aligned = buildDemoPrediction("SITE-001", reference);
    const first = new Date(aligned.points[0].timestamp);
    expect(first.getTime()).toBeGreaterThanOrEqual(Date.parse(reference));
    // L'heure UTC du premier point est inchangée : 01:00 reste 01:00.
    expect(first.getUTCHours()).toBe(new Date(DEMO_PREDICTION.points[0].timestamp).getUTCHours());
  });

  it("reprend l'identifiant du site affiché sans toucher aux valeurs", () => {
    const aligned = buildDemoPrediction("SITE-042", "2026-09-02T00:00:00.000Z");

    expect(aligned.site_id).toBe("SITE-042");
    expect(aligned.points.map((point) => point.predicted_consumption_kw)).toEqual(
      DEMO_PREDICTION.points.map((point) => point.predicted_consumption_kw),
    );
  });

  it("n'applique aucun décalage quand la série est déjà après la référence", () => {
    expect(alignmentShiftMs(DEMO_PREDICTION, "2026-09-01T00:00:00.000Z")).toBe(0);
  });
});
