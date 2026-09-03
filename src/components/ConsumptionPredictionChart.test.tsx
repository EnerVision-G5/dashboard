import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ACTUAL_SERIES_LABEL,
  ConsumptionPredictionChart,
  PREDICTED_SERIES_LABEL,
} from "./ConsumptionPredictionChart";
import { buildChartSeries } from "../lib/series";
import { makePredictionPoint, makeReading } from "../test/doubles";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedSizeContainer } = await import("../test/rechartsMock");
  return withFixedSizeContainer(await importOriginal());
});

const POINTS = buildChartSeries(
  [
    makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 100 }),
    makeReading({ timestamp: "2026-09-02T01:00:00Z", consumption_kw: null }),
    makeReading({ timestamp: "2026-09-02T02:00:00Z", consumption_kw: 110 }),
  ],
  [
    makePredictionPoint({ timestamp: "2026-09-02T03:00:00Z", predicted_consumption_kw: 120 }),
    makePredictionPoint({ timestamp: "2026-09-02T04:00:00Z", predicted_consumption_kw: 125 }),
  ],
);

describe("ConsumptionPredictionChart", () => {
  it("affiche les deux séries et leurs libellés dans la légende", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    expect(screen.getByText(ACTUAL_SERIES_LABEL)).toBeDefined();
    expect(screen.getByText(PREDICTED_SERIES_LABEL)).toBeDefined();
    expect(container.querySelectorAll(".recharts-line-curve").length).toBe(2);
  });

  it("distingue la prédiction par un tracé en pointillés", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    const curves = [...container.querySelectorAll(".recharts-line-curve")];
    const dashed = curves.filter((curve) => curve.getAttribute("stroke-dasharray") !== null);
    expect(dashed).toHaveLength(1);
  });

  it("porte une description accessible", () => {
    render(
      <ConsumptionPredictionChart points={POINTS} description="Consommation du site SITE-001" />,
    );

    expect(screen.getByRole("img", { name: "Consommation du site SITE-001" })).toBeDefined();
  });

  it("interrompt la courbe réelle sur une mesure absente au lieu de la combler", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    const actualCurve = container.querySelector(".recharts-line-curve");
    // Un trou se traduit par une reprise de tracé (« M ») en milieu de chemin ;
    // une courbe comblée n'en contiendrait qu'une, au départ.
    const path = actualCurve?.getAttribute("d") ?? "";
    expect((path.match(/M/g) ?? []).length).toBeGreaterThan(1);
  });
});
