import { describe, expect, it } from "vitest";
import {
  DEFAULT_WINDOW_HOURS,
  predictionWindowFor,
  recentWindow,
  windowHours,
  windowProblem,
} from "./timeWindow";

describe("recentWindow", () => {
  it("produit des bornes ISO 8601 UTC couvrant les 24 dernières heures", () => {
    const window = recentWindow(new Date("2026-09-02T12:00:00.000Z"));

    expect(DEFAULT_WINDOW_HOURS).toBe(24);
    expect(window).toEqual({
      startTime: "2026-09-01T12:00:00.000Z",
      endTime: "2026-09-02T12:00:00.000Z",
    });
  });

  it("accepte une profondeur personnalisée", () => {
    const window = recentWindow(new Date("2026-09-02T12:00:00.000Z"), 6);

    expect(window.startTime).toBe("2026-09-02T06:00:00.000Z");
  });
});

describe("windowHours", () => {
  it("mesure la profondeur d'une fenêtre", () => {
    expect(
      windowHours({
        startTime: "2026-09-03T12:00:00.000Z",
        endTime: "2026-09-04T12:00:00.000Z",
      }),
    ).toBe(24);
  });

  it("est négative sur des bornes inversées", () => {
    expect(
      windowHours({
        startTime: "2026-09-04T12:00:00.000Z",
        endTime: "2026-09-03T12:00:00.000Z",
      }),
    ).toBe(-24);
  });
});

describe("windowProblem", () => {
  it("accepte une fenêtre ordonnée", () => {
    expect(
      windowProblem({
        startTime: "2026-09-03T12:00:00.000Z",
        endTime: "2026-09-04T12:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("refuse des bornes inversées, que le contrat rejetterait en 422", () => {
    expect(
      windowProblem({
        startTime: "2026-09-04T12:00:00.000Z",
        endTime: "2026-09-03T12:00:00.000Z",
      }),
    ).toBe("inversee");
  });

  it("refuse une fenêtre de durée nulle, qui ne rendrait qu'un point", () => {
    const meme = "2026-09-04T12:00:00.000Z";
    expect(windowProblem({ startTime: meme, endTime: meme })).toBe("vide");
  });

  it("refuse une date illisible", () => {
    expect(
      windowProblem({ startTime: "", endTime: "2026-09-04T12:00:00.000Z" }),
    ).toBe("illisible");
  });
});

describe("predictionWindowFor", () => {
  const now = new Date("2026-09-04T12:00:00.000Z");

  it("prolonge la fenêtre vers l'avenir quand elle touche le présent", () => {
    // On veut voir la prévision à venir, qu'une fenêtre s'arrêtant à
    // maintenant ne rencontrerait jamais.
    expect(
      predictionWindowFor(
        { startTime: "2026-09-03T12:00:00.000Z", endTime: "2026-09-04T12:00:00.000Z" },
        now,
        24,
      ),
    ).toEqual({
      startTime: "2026-09-03T12:00:00.000Z",
      endTime: "2026-09-05T12:00:00.000Z",
    });
  });

  it("garde la fenêtre telle quelle sur une période passée", () => {
    // Les prédictions utiles sont celles archivées pendant cette période :
    // prolonger ramènerait des heures que l'écran ne montre pas.
    const passee = {
      startTime: "2026-09-01T00:00:00.000Z",
      endTime: "2026-09-02T00:00:00.000Z",
    };

    expect(predictionWindowFor(passee, now, 24)).toEqual(passee);
  });
});
