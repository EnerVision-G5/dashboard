import { describe, expect, it } from "vitest";
import { CURRENT_MODEL_PATH, MODELS_PATH, fetchCurrentModel, fetchModels } from "./models";
import { ApiError } from "./http";
import { createFakeClient, makeModel } from "../test/doubles";

describe("chemins du registre", () => {
  it("suivent le contrat gelé", () => {
    expect(MODELS_PATH).toBe("/api/v1/models");
    expect(CURRENT_MODEL_PATH).toBe("/api/v1/models/current");
  });
});

describe("fetchModels", () => {
  it("lit le registre complet", async () => {
    const model = makeModel();
    const { instance, calls } = createFakeClient(() => [model]);

    const read = await fetchModels(instance);

    expect(calls).toEqual([{ method: "get", url: MODELS_PATH, params: undefined }]);
    expect(read).toEqual([model]);
  });
});

describe("fetchCurrentModel", () => {
  it("lit le modèle promu", async () => {
    const model = makeModel();
    const { instance, calls } = createFakeClient(() => model);

    const read = await fetchCurrentModel(instance);

    expect(calls).toEqual([{ method: "get", url: CURRENT_MODEL_PATH, params: undefined }]);
    expect(read).toEqual(model);
  });

  it("laisse remonter le 404 avec son code, pour que l'écran le traduise", async () => {
    // Aucun modèle promu est une situation normale : c'est au hook de la
    // distinguer d'une panne, et il lui faut le code pour cela.
    const { instance } = createFakeClient(() => {
      throw new ApiError("Aucun modèle promu.", 404);
    });

    await expect(fetchCurrentModel(instance)).rejects.toMatchObject({ status: 404 });
  });
});
