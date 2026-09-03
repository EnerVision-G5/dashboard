import { describe, expect, it } from "vitest";
import { PREDICTION_HORIZON_HOURS, PREDICT_PATH, fetchPrediction } from "./predictions";
import { createFakeClient, makePrediction } from "../test/doubles";

describe("fetchPrediction", () => {
  it("poste le corps de requête défini par le contrat gelé", async () => {
    const prediction = makePrediction();
    const { instance, calls } = createFakeClient(() => prediction);

    const result = await fetchPrediction({ client: instance, siteId: "SITE-002" });

    expect(PREDICT_PATH).toBe("/api/v1/predict");
    expect(calls).toEqual([
      {
        method: "post",
        url: PREDICT_PATH,
        body: { site_id: "SITE-002", horizon_hours: PREDICTION_HORIZON_HOURS },
      },
    ]);
    expect(PREDICTION_HORIZON_HOURS).toBe(24);
    expect(result).toEqual(prediction);
  });
});
