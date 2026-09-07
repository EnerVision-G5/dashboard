import { describe, expect, it } from "vitest";
import { ALERTS_LIMIT, ALERTS_PATH, fetchAlerts, sortBySeverity } from "./alerts";
import { ApiError } from "./http";
import { createFakeClient, makeAlert } from "../test/doubles";

describe("sortBySeverity", () => {
  it("classe du plus grave au moins grave", () => {
    const trie = sortBySeverity([
      makeAlert({ alert_id: "a", severity: "low" }),
      makeAlert({ alert_id: "b", severity: "critical" }),
      makeAlert({ alert_id: "c", severity: "medium" }),
      makeAlert({ alert_id: "d", severity: "high" }),
    ]);

    // Et non dans l'ordre alphabétique des chaînes, qui donnerait
    // critical, high, low, medium.
    expect(trie.map((alert) => alert.severity)).toEqual([
      "critical",
      "high",
      "medium",
      "low",
    ]);
  });

  it("place la plus récente devant, à gravité égale", () => {
    const trie = sortBySeverity([
      makeAlert({ alert_id: "ancienne", timestamp: "2026-09-02T08:00:00Z" }),
      makeAlert({ alert_id: "recente", timestamp: "2026-09-02T18:00:00Z" }),
    ]);

    expect(trie.map((alert) => alert.alert_id)).toEqual(["recente", "ancienne"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const source = [
      makeAlert({ alert_id: "a", severity: "low" }),
      makeAlert({ alert_id: "b", severity: "critical" }),
    ];

    sortBySeverity(source);

    expect(source.map((alert) => alert.alert_id)).toEqual(["a", "b"]);
  });
});

describe("fetchAlerts", () => {
  it("interroge le chemin du contrat avec la fenêtre et la borne", async () => {
    const alert = makeAlert();
    const { instance, calls } = createFakeClient(() => [alert]);

    const read = await fetchAlerts({
      client: instance,
      siteId: "SITE-001",
      startTime: "2026-09-01T00:00:00.000Z",
      endTime: "2026-09-02T00:00:00.000Z",
    });

    expect(ALERTS_PATH).toBe("/api/v1/alerts");
    expect(calls).toEqual([
      {
        method: "get",
        url: ALERTS_PATH,
        params: {
          site_id: "SITE-001",
          start_time: "2026-09-01T00:00:00.000Z",
          end_time: "2026-09-02T00:00:00.000Z",
          limit: ALERTS_LIMIT,
        },
      },
    ]);
    expect(read).toEqual([alert]);
  });

  it("trie la réponse par gravité, l'API servant un journal chronologique", async () => {
    const { instance } = createFakeClient(() => [
      makeAlert({ alert_id: "recente-benigne", severity: "low" }),
      makeAlert({ alert_id: "ancienne-grave", severity: "critical" }),
    ]);

    const read = await fetchAlerts({ client: instance, siteId: "SITE-001" });

    expect(read.map((alert) => alert.alert_id)).toEqual([
      "ancienne-grave",
      "recente-benigne",
    ]);
  });

  it("traduit un échec de l'API en message affichable", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("L'API métier est injoignable.", null);
    });

    await expect(fetchAlerts({ client: instance, siteId: "SITE-001" })).rejects.toThrow(
      "L'API métier est injoignable.",
    );
  });
});
