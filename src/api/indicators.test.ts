import { describe, expect, it } from "vitest";
import {
  INDICATORS_PATH,
  INDICATORS_WINDOW_HOURS,
  fetchIndicators,
} from "./indicators";
import { ApiError } from "./http";
import { createFakeClient, makeSiteIndicators } from "../test/doubles";

describe("fetchIndicators", () => {
  it("interroge le chemin du contrat gelé pour tout le parc", async () => {
    const indicators = makeSiteIndicators();
    const { instance, calls } = createFakeClient(() => [indicators]);

    const read = await fetchIndicators({ client: instance });

    expect(INDICATORS_PATH).toBe("/api/v1/indicators");
    expect(calls).toEqual([
      {
        method: "get",
        url: INDICATORS_PATH,
        params: { window_hours: INDICATORS_WINDOW_HOURS },
      },
    ]);
    expect(read).toEqual([indicators]);
  });

  it("demande la fenêtre qu'on lui passe", async () => {
    const { instance, calls } = createFakeClient(() => []);

    await fetchIndicators({ client: instance, windowHours: 6 });

    expect(calls[0].params).toEqual({ window_hours: 6 });
  });

  it("traduit un échec de l'API en erreur affichable", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("L'API métier est injoignable.", null);
    });

    await expect(fetchIndicators({ client: instance })).rejects.toThrow(
      "L'API métier est injoignable.",
    );
  });
});
