import { describe, expect, it } from "vitest";
import {
  RECOMMENDATIONS_HORIZON_HOURS,
  fetchRecommendations,
  isDegraded,
  recommendationsPath,
} from "./recommendations";
import { ApiError } from "./http";
import {
  createFakeClient,
  makeRecommendation,
  makeRecommendations,
} from "../test/doubles";

describe("recommendationsPath", () => {
  it("suit le chemin du contrat gelé", () => {
    expect(recommendationsPath("SITE-001")).toBe("/api/v1/sites/SITE-001/recommendations");
  });

  it("encode un identifiant de site exotique", () => {
    expect(recommendationsPath("site/001")).toBe("/api/v1/sites/site%2F001/recommendations");
  });
});

describe("fetchRecommendations", () => {
  it("demande l'horizon aligné sur la fenêtre affichée", async () => {
    const recommendations = makeRecommendations();
    const { instance, calls } = createFakeClient(() => recommendations);

    const read = await fetchRecommendations({ client: instance, siteId: "SITE-001" });

    expect(RECOMMENDATIONS_HORIZON_HOURS).toBe(24);
    expect(calls).toEqual([
      {
        method: "get",
        url: "/api/v1/sites/SITE-001/recommendations",
        params: { horizon_hours: RECOMMENDATIONS_HORIZON_HOURS },
      },
    ]);
    expect(read).toEqual(recommendations);
  });

  it("transmet l'horizon qu'on lui passe", async () => {
    const { instance, calls } = createFakeClient(() => makeRecommendations());

    await fetchRecommendations({ client: instance, siteId: "SITE-001", horizonHours: 6 });

    expect(calls[0].params).toEqual({ horizon_hours: 6 });
  });

  it("rend la liste dans l'ordre servi par l'API, sans la retrier", async () => {
    // L'API classe de la plus urgente à la moins urgente ; le client ne doit
    // pas substituer son propre tri à celui du service.
    const recommendations = makeRecommendations({
      items: [
        { type: "predicted_peak", severity: "low", message: "Première servie" },
        { type: "capacity_overrun", severity: "critical", message: "Seconde servie" },
      ],
    });
    const { instance } = createFakeClient(() => recommendations);

    const read = await fetchRecommendations({ client: instance, siteId: "SITE-001" });

    expect(read.items.map((item) => item.message)).toEqual([
      "Première servie",
      "Seconde servie",
    ]);
  });

  it("remonte le 404 du contrat sur un site inconnu", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("Site inconnu de l'API métier (404).", 404);
    });

    await expect(
      fetchRecommendations({ client: instance, siteId: "SITE-404" }),
    ).rejects.toThrow("Site inconnu de l'API métier (404).");
  });
});

describe("isDegraded", () => {
  it("est vrai quand des actions sont servies sans version de modèle", () => {
    // Mode dégradé de l'API : le service d'inférence est indisponible, seule
    // la règle capteur — indépendante de la prévision — a pu s'appliquer.
    expect(
      isDegraded(
        makeRecommendations({
          model_version: null,
          items: [makeRecommendation({ type: "sensor_failure" })],
        }),
      ),
    ).toBe(true);
  });

  it("est faux quand une version de modèle fonde les actions", () => {
    expect(isDegraded(makeRecommendations())).toBe(false);
  });

  it("est faux sur une liste vide, qui n'est pas un mode dégradé", () => {
    // Aucune action et aucune prévision : c'est une absence, pas un service
    // qui tourne en repli.
    expect(isDegraded(makeRecommendations({ items: [], model_version: null }))).toBe(false);
  });
});
