import { describe, expect, it } from "vitest";
import { fetchSensors, sensorsPath } from "./sensors";
import { ApiError } from "./http";
import { createFakeClient, makeSensorHealth } from "../test/doubles";

describe("sensorsPath", () => {
  it("suit le chemin du contrat gelé", () => {
    expect(sensorsPath("SITE-001")).toBe("/api/v1/sites/SITE-001/sensors");
  });

  it("encode un identifiant de site exotique", () => {
    expect(sensorsPath("site/001")).toBe("/api/v1/sites/site%2F001/sensors");
  });
});

describe("fetchSensors", () => {
  it("lit l'état des capteurs du site demandé", async () => {
    const sensor = makeSensorHealth();
    const { instance, calls } = createFakeClient(() => [sensor]);

    const read = await fetchSensors(instance, "SITE-001");

    expect(calls).toEqual([
      { method: "get", url: "/api/v1/sites/SITE-001/sensors", params: undefined },
    ]);
    expect(read).toEqual([sensor]);
  });

  it("traduit un site inconnu en erreur affichable", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("Site inconnu de l'API métier (404).", 404);
    });

    await expect(fetchSensors(instance, "SITE-404")).rejects.toThrow(
      "Site inconnu de l'API métier (404).",
    );
  });
});
