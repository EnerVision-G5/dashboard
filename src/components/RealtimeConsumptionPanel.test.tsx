import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MISSING_VALUE, RealtimeConsumptionPanel } from "./RealtimeConsumptionPanel";
import { makeReading } from "../test/doubles";

const NOW = new Date("2026-09-03T10:00:00Z");

/** Mesure fraîche à l'instant de référence des tests. */
function freshReading(overrides: Parameters<typeof makeReading>[0] = {}) {
  return makeReading({ timestamp: "2026-09-03T09:59:30Z", ...overrides });
}

function renderPanel(
  props: Partial<Parameters<typeof RealtimeConsumptionPanel>[0]> = {},
) {
  render(
    <RealtimeConsumptionPanel
      reading={freshReading()}
      isLoading={false}
      error={null}
      now={NOW}
      {...props}
    />,
  );
}

describe("RealtimeConsumptionPanel", () => {
  it("affiche la puissance instantanée et les quatre grandeurs secondaires", () => {
    renderPanel({
      reading: freshReading({
        consumption_kw: 2654,
        voltage_v: 401.2,
        current_a: 132.5,
        temperature_celsius: 22.1,
        humidity_percent: 58.4,
      }),
    });

    expect(screen.getByText("2 654 kW")).toBeDefined();
    expect(screen.getByText("401,2 V")).toBeDefined();
    expect(screen.getByText("132,5 A")).toBeDefined();
    expect(screen.getByText("22,1 °C")).toBeDefined();
    expect(screen.getByText("58,4 %")).toBeDefined();
  });

  it("affiche une mesure absente comme absente, jamais comme un zéro", () => {
    renderPanel({
      reading: freshReading({ consumption_kw: null, voltage_v: null }),
    });

    expect(screen.getAllByText(MISSING_VALUE)).toHaveLength(2);
    expect(screen.queryByText("0 kW")).toBeNull();
  });

  it("ne substitue jamais la valeur imputée à la mesure brute", () => {
    renderPanel({
      reading: freshReading({
        consumption_kw: null,
        consumption_kw_imputed: 2600,
        imputation_method: "locf",
      }),
    });

    expect(screen.queryByText("2 600 kW")).toBeNull();
    expect(screen.getByText(/L'ETL en a reconstitué une par locf/)).toBeDefined();
  });

  it("signale un retard d'ingestion au-delà de deux minutes", () => {
    renderPanel({ reading: makeReading({ timestamp: "2026-09-03T09:55:00Z" }) });

    expect(screen.getByText(/l'ingestion est en retard/)).toBeDefined();
  });

  it("ne signale aucun retard sur une mesure fraîche", () => {
    renderPanel();

    expect(screen.queryByText(/l'ingestion est en retard/)).toBeNull();
  });

  it("reprend la qualité annoncée par la source quand elle n'est pas bonne", () => {
    renderPanel({ reading: freshReading({ data_quality: "degraded" }) });

    expect(screen.getByText(/Qualité de la mesure annoncée par la source : degraded/)).toBeDefined();
  });

  it("reprend les motifs d'absence fournis par la source", () => {
    renderPanel({
      reading: freshReading({ null_reasons: ["sensor_offline", "timeout"] }),
    });

    expect(screen.getByText(/sensor_offline, timeout/)).toBeDefined();
  });

  it("annonce le chargement de la première mesure", () => {
    renderPanel({ reading: null, isLoading: true });

    expect(screen.getByRole("status").textContent).toContain("Chargement");
  });

  it("affiche l'erreur du flux plutôt qu'une valeur d'âge inconnu", () => {
    renderPanel({ reading: null, error: "Site introuvable." });

    expect(screen.getByRole("alert").textContent).toBe("Site introuvable.");
    expect(screen.queryByText(/Relevé du/)).toBeNull();
  });

  it("annonce un site sans aucune mesure", () => {
    renderPanel({ reading: null });

    expect(screen.getByText("Aucune mesure connue pour ce site.")).toBeDefined();
  });
});
