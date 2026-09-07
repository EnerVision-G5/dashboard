import { describe, expect, it } from "vitest";
import {
  SENSOR_HISTORY_LIMIT,
  fetchSensorHistory,
  fetchSensors,
  sensorHistoryPath,
  sensorsPath,
} from "./sensors";
import { ApiError } from "./http";
import {
  createFakeClient,
  makeSensorFailure,
  makeSensorHealth,
} from "../test/doubles";

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

describe("fetchSensorHistory", () => {
  it("suit le chemin du contrat gelé", () => {
    expect(sensorHistoryPath("SITE-001")).toBe("/api/v1/sites/SITE-001/sensors/history");
  });

  it("borne la liste et ne filtre pas les pannes en cours", async () => {
    const failure = makeSensorFailure();
    const { instance, calls } = createFakeClient(() => [failure]);

    const read = await fetchSensorHistory(instance, "SITE-001");

    // `ongoing` n'est pas passé : les épisodes en cours et terminés arrivent
    // dans la même liste, chacun portant son propre `ongoing`.
    expect(calls).toEqual([
      {
        method: "get",
        url: "/api/v1/sites/SITE-001/sensors/history",
        params: { limit: SENSOR_HISTORY_LIMIT },
      },
    ]);
    expect(read).toEqual([failure]);
  });

  it("traduit un échec en erreur affichable", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("L'API métier est injoignable.", null);
    });

    await expect(fetchSensorHistory(instance, "SITE-001")).rejects.toThrow(
      "L'API métier est injoignable.",
    );
  });
});
