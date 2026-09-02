import { describe, expect, it } from "vitest";
import { SITES_PATH, fetchSites, pickInitialSite } from "./sites";
import { createFakeClient, makeSite } from "../test/doubles";

describe("fetchSites", () => {
  it("interroge le chemin du contrat gelé", async () => {
    const site = makeSite();
    const { instance, calls } = createFakeClient(() => [site]);

    const sites = await fetchSites(instance);

    expect(calls).toEqual([{ method: "get", url: SITES_PATH, params: undefined }]);
    expect(SITES_PATH).toBe("/api/v1/sites");
    expect(sites).toEqual([site]);
  });
});

describe("pickInitialSite", () => {
  it("retient le premier site actif comme valeur initiale", () => {
    const inactif = makeSite({ site_id: "SITE-001", status: "maintenance" });
    const actif = makeSite({ site_id: "SITE-002", status: "active" });

    expect(pickInitialSite([inactif, actif])?.site_id).toBe("SITE-002");
  });

  it("retombe sur le premier site quand aucun n'est actif", () => {
    const premier = makeSite({ site_id: "SITE-001", status: "maintenance" });

    expect(pickInitialSite([premier])?.site_id).toBe("SITE-001");
  });

  it("renvoie null sur un référentiel vide", () => {
    expect(pickInitialSite([])).toBeNull();
  });
});
