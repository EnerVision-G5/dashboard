import { afterEach, describe, expect, it, vi } from "vitest";
import { token } from "./tokens";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("token", () => {
  it("rend une couleur pour chaque jeton du graphique", () => {
    for (const name of ["mesure", "estimation", "grille", "axe"] as const) {
      expect(token(name)).toMatch(/^#|^oklch|^rgb/);
    }
  });

  it("distingue la série mesurée de la série estimée", () => {
    expect(token("mesure")).not.toBe(token("estimation"));
  });

  it("ne rend jamais une chaîne vide, qui ferait échouer le tracé SVG", () => {
    for (const name of ["mesure", "estimation", "grille", "axe"] as const) {
      expect(token(name)).not.toBe("");
    }
  });

  it("mémorise la valeur plutôt que de recalculer le style à chaque tracé", () => {
    const spy = vi.spyOn(globalThis, "getComputedStyle");

    token("mesure");
    token("mesure");
    token("mesure");

    // Résolu au premier appel du module, jamais au-delà.
    expect(spy).not.toHaveBeenCalled();
  });
});
