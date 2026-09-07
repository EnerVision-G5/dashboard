import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertsPanel } from "./AlertsPanel";
import { sortBySeverity } from "../api/alerts";
import { makeAlert } from "../test/doubles";

function renderPanel(overrides: Partial<React.ComponentProps<typeof AlertsPanel>> = {}) {
  render(
    <AlertsPanel
      alerts={[makeAlert()]}
      isLoading={false}
      error={null}
      windowHours={24}
      {...overrides}
    />,
  );
}

describe("AlertsPanel", () => {
  it("annonce le chargement", () => {
    renderPanel({ isLoading: true, alerts: [] });

    expect(screen.getByRole("status").textContent).toContain("Lecture des alertes du site");
  });

  it("affiche l'erreur de l'API plutôt qu'une absence d'alerte", () => {
    renderPanel({ alerts: [], error: "L'API métier est injoignable." });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Alertes indisponibles");
    // Une panne n'est pas un site sans incident.
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("distingue une fenêtre sans alerte d'un flux tombé", () => {
    renderPanel({ alerts: [] });

    expect(screen.getByText("Aucune alerte sur la fenêtre.")).toBeDefined();
    expect(screen.getByText(/ne publie que les alertes actives/)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("situe la liste dans le temps", () => {
    renderPanel({ windowHours: 6 });

    expect(screen.getByText("Sur les 6 dernières heures")).toBeDefined();
  });

  it("affiche le type, la gravité écrite et le message de la source", () => {
    renderPanel();

    expect(screen.getByText("élevée")).toBeDefined();
    expect(screen.getByText("pic de consommation")).toBeDefined();
    expect(screen.getByText("Pic de consommation détecté sur le site.")).toBeDefined();
  });

  it("montre l'écart entre le relevé et le seuil franchi", () => {
    renderPanel();

    expect(screen.getByText("Relevé 812 kW · seuil 500 kW")).toBeDefined();
  });

  it("n'affiche aucun chiffre quand la source n'en sert pas", () => {
    renderPanel({ alerts: [makeAlert({ value: null, threshold: null })] });

    expect(screen.queryByText(/kW/)).toBeNull();
  });

  it("affiche le seul chiffre servi quand l'autre manque", () => {
    renderPanel({ alerts: [makeAlert({ value: 812, threshold: null })] });

    expect(screen.getByText("Relevé 812 kW")).toBeDefined();
  });

  it("traduit les cinq natures d'anomalie du contrat", () => {
    renderPanel({
      alerts: [
        makeAlert({ alert_id: "1", type: "spike" }),
        makeAlert({ alert_id: "2", type: "threshold" }),
        makeAlert({ alert_id: "3", type: "anomaly" }),
        makeAlert({ alert_id: "4", type: "outage" }),
        makeAlert({ alert_id: "5", type: "sensor" }),
      ],
    });

    expect(screen.getByText("pic de consommation")).toBeDefined();
    expect(screen.getByText("seuil dépassé")).toBeDefined();
    expect(screen.getByText("anomalie")).toBeDefined();
    expect(screen.getByText("coupure")).toBeDefined();
    expect(screen.getByText("capteur")).toBeDefined();
  });

  it("affiche les alertes dans l'ordre de gravité reçu", () => {
    renderPanel({
      alerts: sortBySeverity([
        makeAlert({ alert_id: "1", severity: "low", message: "Bénigne" }),
        makeAlert({ alert_id: "2", severity: "critical", message: "Grave" }),
      ]),
    });

    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("Grave");
    expect(items[1]).toContain("Bénigne");
  });
});
