import { describe, expect, it } from "vitest";
import {
  PREDICTIONS_PAGE_LIMIT,
  PREDICTION_HORIZON_HOURS,
  fetchPredictions,
  predictionsPath,
  toPrediction,
} from "./predictions";
import {
  createFakeClient,
  makePredictionPoint,
  makePredictionsPage,
} from "../test/doubles";

const WINDOW = {
  startTime: "2026-09-03T12:00:00Z",
  endTime: "2026-09-04T12:00:00Z",
};

describe("fetchPredictions", () => {
  it("lit la route de l'API métier avec la fenêtre du contrat", async () => {
    const page = makePredictionsPage();
    const { instance, calls } = createFakeClient(() => page);

    const result = await fetchPredictions({
      client: instance,
      siteId: "SITE-002",
      ...WINDOW,
    });

    expect(predictionsPath("SITE-002")).toBe("/api/v1/sites/SITE-002/predictions");
    expect(calls).toEqual([
      {
        method: "get",
        url: "/api/v1/sites/SITE-002/predictions",
        params: {
          start_time: WINDOW.startTime,
          end_time: WINDOW.endTime,
          limit: PREDICTIONS_PAGE_LIMIT,
        },
      },
    ]);
    expect(PREDICTION_HORIZON_HOURS).toBe(24);
    expect(result.siteId).toBe("SITE-002");
    expect(result.points).toEqual(page.items);
  });

  it("encode l'identifiant de site dans le chemin", () => {
    // Un identifiant n'a aucune raison de contenir une barre oblique, mais
    // l'encoder évite qu'une valeur inattendue change la route appelée.
    expect(predictionsPath("SITE/../autre")).toBe(
      "/api/v1/sites/SITE%2F..%2Fautre/predictions",
    );
  });
});

describe("toPrediction", () => {
  it("retient la version du point le plus récemment produit", () => {
    // La fenêtre peut mêler deux générations si le job a tourné entre-temps :
    // c'est la plus fraîche qui décrit ce que le graphique montre.
    const page = makePredictionsPage([
      makePredictionPoint({
        model_version: "3",
        generated_at: "2026-09-03T08:00:00Z",
      }),
      makePredictionPoint({
        timestamp: "2026-09-02T02:00:00Z",
        model_version: "4",
        generated_at: "2026-09-03T09:00:00Z",
      }),
    ]);

    const prediction = toPrediction("SITE-001", page);

    expect(prediction.modelVersion).toBe("4");
    expect(prediction.generatedAt).toBe("2026-09-03T09:00:00Z");
    expect(prediction.points).toHaveLength(2);
  });

  it("rend une série vide sans version quand rien n'est archivé", () => {
    // Cas normal tant que le job planifié n'a pas tourné : la page est vide,
    // ce n'est pas une erreur.
    const prediction = toPrediction("SITE-001", makePredictionsPage([]));

    expect(prediction.points).toEqual([]);
    expect(prediction.modelVersion).toBeNull();
    expect(prediction.generatedAt).toBeNull();
  });
});
