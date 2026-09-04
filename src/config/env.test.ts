import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, getApiBaseUrl, getPredictionSource } from "./env";

/** Pose la configuration qu'injecterait /config.js dans une image. */
function injecte(config: Record<string, string>) {
  window.__ENERVISION_CONFIG__ = config;
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete window.__ENERVISION_CONFIG__;
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

  it("se laisse piloter par la configuration injectée", () => {
    injecte({ predictionSource: "fixture" });

    expect(getPredictionSource()).toBe("fixture");
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

describe("configuration injectée au démarrage du conteneur", () => {
  it("est lue quand elle est présente", () => {
    injecte({ apiBaseUrl: "https://api.enervision.com" });

    expect(getApiBaseUrl()).toBe("https://api.enervision.com");
  });

  it("l'emporte sur le .env du build : en image, c'est elle qui fait foi", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://poste-de-dev.test");
    injecte({ apiBaseUrl: "https://api.enervision.com" });

    expect(getApiBaseUrl()).toBe("https://api.enervision.com");
  });

  it("laisse la main au .env quand elle est vide, cas du greffon de développement", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    injecte({ apiBaseUrl: "" });

    expect(getApiBaseUrl()).toBe("http://api.test");
  });

  it("laisse la main au .env quand /config.js n'a rien posé du tout", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
    injecte({});

    expect(getApiBaseUrl()).toBe("http://api.test");
  });

  it("échoue quand aucune des deux sources ne renseigne l'adresse", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    injecte({ apiBaseUrl: "" });

    expect(() => getApiBaseUrl()).toThrow(ConfigurationError);
  });

  it("nomme la variable manquante dans le message d'erreur", () => {
    vi.stubEnv("VITE_API_BASE_URL", "");

    expect(() => getApiBaseUrl()).toThrow(/VITE_API_BASE_URL/);
  });

  it("supprime aussi le slash final d'une adresse injectée", () => {
    injecte({ apiBaseUrl: "https://api.enervision.com/" });

    expect(getApiBaseUrl()).toBe("https://api.enervision.com");
  });
});
