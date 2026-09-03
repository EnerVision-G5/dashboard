import { describe, expect, it } from "vitest";
import type { ReadingsPage } from "./readings";
import {
  MAX_READING_PAGES,
  READINGS_PAGE_LIMIT,
  fetchReadings,
  readingsPath,
} from "./readings";
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
