import { describe, expect, it } from "vitest";
import type { ReadingsPage } from "./readings";
import {
  MAX_READING_PAGES,
  READINGS_PAGE_LIMIT,
  fetchLatestReading,
  fetchReadings,
  isStale,
  readingsPath,
} from "./readings";
import { ApiError } from "./http";
import { createFakeClient, makeReading } from "../test/doubles";

const WINDOW = {
  startTime: "2026-09-01T00:00:00.000Z",
  endTime: "2026-09-02T00:00:00.000Z",
};

function page(items: number, total: number, offset: number): ReadingsPage {
  return {
    items: Array.from({ length: items }, (_unused, index) =>
      makeReading({
        timestamp: new Date(Date.UTC(2026, 8, 1, 0, offset + index)).toISOString(),
      }),
    ),
    meta: { total, limit: READINGS_PAGE_LIMIT, offset },
  };
}

describe("fetchReadings", () => {
  it("construit la requête avec le chemin et les bornes du contrat", async () => {
    const { instance, calls } = createFakeClient(() => page(1, 1, 0));

    await fetchReadings({ client: instance, siteId: "SITE-001", ...WINDOW });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/v1/sites/SITE-001/readings");
    expect(calls[0].params).toEqual({
      start_time: WINDOW.startTime,
      end_time: WINDOW.endTime,
      limit: READINGS_PAGE_LIMIT,
      offset: 0,
    });
  });

  it("encode l'identifiant de site dans le chemin", () => {
    expect(readingsPath("SITE 1/2")).toBe("/api/v1/sites/SITE%201%2F2/readings");
  });

  it("suit la pagination jusqu'à couvrir toute la fenêtre", async () => {
    const total = READINGS_PAGE_LIMIT + 440;
    const { instance, calls } = createFakeClient((call) => {
      const offset = Number(call.params?.offset ?? 0);
      return page(Math.min(READINGS_PAGE_LIMIT, total - offset), total, offset);
    });

    const readings = await fetchReadings({
      client: instance,
      siteId: "SITE-001",
      ...WINDOW,
    });

    expect(calls.map((call) => call.params?.offset)).toEqual([0, READINGS_PAGE_LIMIT]);
    expect(readings).toHaveLength(total);
  });

  it("s'arrête sur une page vide même si le total annonce davantage", async () => {
    const { instance, calls } = createFakeClient(() => page(0, 5000, 0));

    const readings = await fetchReadings({
      client: instance,
      siteId: "SITE-001",
      ...WINDOW,
    });

    expect(calls).toHaveLength(1);
    expect(readings).toEqual([]);
  });

  it("borne la boucle quand le serveur annonce un total incohérent", async () => {
    const { instance, calls } = createFakeClient((call) => {
      const offset = Number(call.params?.offset ?? 0);
      return page(READINGS_PAGE_LIMIT, Number.MAX_SAFE_INTEGER, offset);
    });

    await fetchReadings({ client: instance, siteId: "SITE-001", ...WINDOW });

    expect(calls).toHaveLength(MAX_READING_PAGES);
  });
});

describe("fetchLatestReading", () => {
  it("appelle le chemin de la dernière mesure du contrat gelé", async () => {
    const reading = makeReading({ site_id: "SITE-001" });
    const { instance, calls } = createFakeClient(() => reading);

    await expect(fetchLatestReading(instance, "SITE-001")).resolves.toEqual(reading);
    expect(calls[0].url).toBe("/api/v1/sites/SITE-001/readings/latest");
  });

  it("encode un identifiant de site contenant un caractère réservé", async () => {
    const { instance, calls } = createFakeClient(() => makeReading());

    await fetchLatestReading(instance, "SITE/001");

    expect(calls[0].url).toBe("/api/v1/sites/SITE%2F001/readings/latest");
  });

  it("laisse remonter un 404 plutôt que d'inventer une mesure vide", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("Site SITE-999 introuvable.", 404);
    });

    await expect(fetchLatestReading(instance, "SITE-999")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("isStale", () => {
  const now = new Date("2026-09-03T10:00:00Z");

  it("tient pour fraîche une mesure de moins de deux minutes", () => {
    const reading = makeReading({ timestamp: "2026-09-03T09:59:00Z" });

    expect(isStale(reading, now)).toBe(false);
  });

  it("signale une mesure plus vieille que le seuil d'ingestion", () => {
    const reading = makeReading({ timestamp: "2026-09-03T09:57:00Z" });

    expect(isStale(reading, now)).toBe(true);
  });

  it("tient pour en retard une mesure dont l'horodatage est illisible", () => {
    const reading = makeReading({ timestamp: "pas-une-date" });

    expect(isStale(reading, now)).toBe(true);
  });
});
