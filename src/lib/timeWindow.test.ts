import { describe, expect, it } from "vitest";
import { DEFAULT_WINDOW_HOURS, recentWindow } from "./timeWindow";

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
