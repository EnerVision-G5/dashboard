import { describe, expect, it } from "vitest";
import {
  INDICATORS_PATH,
  INDICATORS_WINDOW_HOURS,
  fetchIndicators,
  fetchSiteIndicators,
  siteIndicatorsPath,
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

describe("fetchSiteIndicators", () => {
  it("interroge la route dédiée au site, avec la fenêtre", async () => {
    const indicators = makeSiteIndicators();
    const { instance, calls } = createFakeClient(() => indicators);

    const read = await fetchSiteIndicators({ client: instance, siteId: "SITE-001" });

    expect(siteIndicatorsPath("SITE-001")).toBe("/api/v1/sites/SITE-001/indicators");
    expect(calls).toEqual([
      {
        method: "get",
        url: "/api/v1/sites/SITE-001/indicators",
        params: { window_hours: INDICATORS_WINDOW_HOURS },
      },
    ]);
    expect(read).toEqual(indicators);
  });

  it("encode un identifiant de site exotique", () => {
    expect(siteIndicatorsPath("site/001")).toBe("/api/v1/sites/site%2F001/indicators");
  });

  it("remonte le 404 du contrat sur un site inconnu", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("Site inconnu de l'API métier (404).", 404);
    });

    await expect(
      fetchSiteIndicators({ client: instance, siteId: "SITE-404" }),
    ).rejects.toThrow("Site inconnu de l'API métier (404).");
  });
});
