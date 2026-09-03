import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, getApiBaseUrl, getPredictionSource } from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getPredictionSource", () => {
  it("vaut api par défaut", () => {
    expect(getPredictionSource()).toBe("api");
  });

  it("passe en fixture uniquement sur une valeur explicite", () => {
    vi.stubEnv("VITE_PREDICTION_SOURCE", "fixture");

    expect(getPredictionSource()).toBe("fixture");
  });

  it("retombe sur api devant une valeur inconnue plutôt que de simuler", () => {
    vi.stubEnv("VITE_PREDICTION_SOURCE", "Fixture ");

    expect(getPredictionSource()).toBe("api");
  });
});

describe("getApiBaseUrl", () => {
  it("échoue clairement quand la variable n'est pas renseignée", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    expect(() => getApiBaseUrl()).toThrow(ConfigurationError);
  });

  it("supprime le slash final pour éviter les doubles slashs", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test/");

    expect(getApiBaseUrl()).toBe("http://api.test");
  });
});
