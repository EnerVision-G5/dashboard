import { describe, expect, it } from "vitest";
import {
  SPIKES_LIMIT,
  SPIKES_PATH,
  SPIKE_DURATION_MINUTES,
  fetchSpikes,
  triggerSpike,
  triggerSpikePath,
} from "./simulations";
import { ApiError } from "./http";
import { createFakeClient, makeSpikeSimulation } from "../test/doubles";

describe("chemins des simulations", () => {
  it("suivent le contrat gelé", () => {
    expect(SPIKES_PATH).toBe("/api/v1/simulations/spike");
    expect(triggerSpikePath("SITE-001")).toBe("/api/v1/simulations/spike/SITE-001");
  });

  it("encodent un identifiant de site exotique", () => {
    expect(triggerSpikePath("site/001")).toBe("/api/v1/simulations/spike/site%2F001");
  });
});

describe("fetchSpikes", () => {
  it("restreint au site demandé et borne la liste", async () => {
    const spike = makeSpikeSimulation();
    const { instance, calls } = createFakeClient(() => [spike]);

    const read = await fetchSpikes({ client: instance, siteId: "SITE-001" });

    expect(calls).toEqual([
      {
        method: "get",
        url: SPIKES_PATH,
        params: { site_id: "SITE-001", limit: SPIKES_LIMIT },
      },
    ]);
    expect(read).toEqual([spike]);
  });

  it("lit le parc entier quand aucun site n'est précisé", async () => {
    const { instance, calls } = createFakeClient(() => []);

    await fetchSpikes({ client: instance });

    expect(calls[0].params).toEqual({ site_id: undefined, limit: SPIKES_LIMIT });
  });
});

describe("triggerSpike", () => {
  it("poste la durée du contrat sans corps de requête", async () => {
    const spike = makeSpikeSimulation();
    const { instance, calls } = createFakeClient(() => spike);

    const created = await triggerSpike({ client: instance, siteId: "SITE-001" });

    expect(calls[0].method).toBe("post");
    expect(calls[0].url).toBe("/api/v1/simulations/spike/SITE-001");
    // La durée voyage en paramètre de requête, le contrat ne définit aucun
    // corps pour cette route.
    expect(calls[0].body).toBeUndefined();
    expect(created).toEqual(spike);
    expect(SPIKE_DURATION_MINUTES).toBe(30);
  });

  it("transmet la durée qu'on lui passe", async () => {
    const { instance, calls } = createFakeClient(() => makeSpikeSimulation());

    await triggerSpike({ client: instance, siteId: "SITE-001", durationMinutes: 5 });

    expect(calls[0].params).toEqual({ duration_minutes: 5 });
  });

  it("traduit un refus de rôle en message affichable", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("Rôle insuffisant pour cette opération (403).", 403);
    });

    await expect(triggerSpike({ client: instance, siteId: "SITE-001" })).rejects.toThrow(
      "Rôle insuffisant pour cette opération (403).",
    );
  });

  it("distingue une source qui n'a pas répondu d'un refus de rôle", async () => {
    const { instance } = createFakeClient(() => {
      throw new ApiError("L'API métier a renvoyé une erreur serveur (502).", 502);
    });

    await expect(
      triggerSpike({ client: instance, siteId: "SITE-001" }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
