import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RealtimeConsumptionPanel } from "./RealtimeConsumptionPanel";
import { MISSING_VALUE } from "../ui/MetricTile";
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

    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("Mesure temps réel indisponible");
    expect(alerte.textContent).toContain("Site introuvable.");
    expect(screen.queryByText(/Relevé du/)).toBeNull();
  });

  it("annonce un site sans aucune mesure", () => {
    renderPanel({ reading: null });

    expect(screen.getByText("Aucune mesure connue pour ce site.")).toBeDefined();
  });
});

describe("RealtimeConsumptionPanel · contrat 1.5.0 (EV-52)", () => {
  const now = new Date("2026-09-03T10:00:00Z");

  it("suit le seuil de retard servi par l'API plutôt que le sien", () => {
    // Trois minutes : en retard sur le seuil interne de deux minutes, dans les
    // temps sur les cinq minutes annoncées par l'API.
    const reading = makeReading({ timestamp: "2026-09-03T09:57:00Z" });

    render(
      <RealtimeConsumptionPanel
        reading={reading}
        isLoading={false}
        error={null}
        now={now}
        staleThresholdSeconds={300}
      />,
    );

    expect(screen.queryByText(/l'ingestion est en retard/)).toBeNull();
  });

  it("nomme le seuil de l'API quand la mesure le dépasse", () => {
    const reading = makeReading({ timestamp: "2026-09-03T09:50:00Z" });

    render(
      <RealtimeConsumptionPanel
        reading={reading}
        isLoading={false}
        error={null}
        now={now}
        staleThresholdSeconds={300}
      />,
    );

    expect(
      screen.getByText(
        "Dernière mesure plus vieille que le seuil de 5 min servi par l'API : l'ingestion est en retard.",
      ),
    ).toBeDefined();
  });

  it("retombe sur le seuil du guide quand l'API n'en fournit pas", () => {
    const reading = makeReading({ timestamp: "2026-09-03T09:57:00Z" });

    render(
      <RealtimeConsumptionPanel reading={reading} isLoading={false} error={null} now={now} />,
    );

    expect(
      screen.getByText(
        "Dernière mesure vieille de plus de deux minutes : l'ingestion est en retard.",
      ),
    ).toBeDefined();
  });

  it("signale une mesure écartée des agrégats, avec son motif", () => {
    const reading = makeReading({
      consumption_kw: 4820,
      excluded: true,
      exclusion_reason: "spike_simule",
    });

    render(
      <RealtimeConsumptionPanel reading={reading} isLoading={false} error={null} now={now} />,
    );

    expect(screen.getByText(/Mesure écartée des calculs agrégés : spike_simule/)).toBeDefined();
    // La valeur reste affichée : l'API ne la cache pas, l'écran non plus.
    expect(screen.getByText("4 820 kW")).toBeDefined();
  });

  it("dit qu'aucun motif n'est précisé plutôt que d'en inventer", () => {
    const reading = makeReading({ excluded: true, exclusion_reason: null });

    render(
      <RealtimeConsumptionPanel reading={reading} isLoading={false} error={null} now={now} />,
    );

    expect(
      screen.getByText(/Mesure écartée des calculs agrégés, sans motif précisé par la source/),
    ).toBeDefined();
  });

  it("ne dit rien de l'exclusion sur une mesure retenue", () => {
    render(
      <RealtimeConsumptionPanel
        reading={makeReading()}
        isLoading={false}
        error={null}
        now={now}
      />,
    );

    expect(screen.queryByText(/écartée des calculs agrégés/)).toBeNull();
  });
});

describe("RealtimeConsumptionPanel · disposition en bande", () => {
  it("range les cinq valeurs sur une ligne", () => {
    const { container } = render(
      <RealtimeConsumptionPanel
        reading={makeReading()}
        isLoading={false}
        error={null}
        layout="bande"
      />,
    );

    // Empilées dans une colonne d'un tiers de largeur, ces cinq valeurs
    // occupaient une hauteur d'écran pour rien.
    const grille = container.querySelector('[class*="grid-cols-5"]');
    expect(grille).not.toBeNull();
    expect(grille?.children).toHaveLength(5);
  });

  it("garde la disposition en colonne par défaut", () => {
    const { container } = render(
      <RealtimeConsumptionPanel reading={makeReading()} isLoading={false} error={null} />,
    );

    expect(container.querySelector('[class*="grid-cols-5"]')).toBeNull();
  });

  it("affiche les mêmes valeurs dans les deux dispositions", () => {
    render(
      <RealtimeConsumptionPanel
        reading={makeReading({ consumption_kw: 157, voltage_v: 399.4 })}
        isLoading={false}
        error={null}
        layout="bande"
      />,
    );

    expect(screen.getByText("157 kW")).toBeDefined();
    expect(screen.getByText("399,4 V")).toBeDefined();
  });
});
