import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { makeRecommendation, makeRecommendations } from "../test/doubles";

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof RecommendationsPanel>> = {},
) {
  render(
    <RecommendationsPanel
      recommendations={makeRecommendations()}
      isLoading={false}
      error={null}
      {...overrides}
    />,
  );
}

describe("RecommendationsPanel", () => {
  it("tient sa place dans la mise en page avec un titre lisible", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Recommandations", level: 2 })).toBeDefined();
  });

  it("annonce le calcul en cours", () => {
    renderPanel({ isLoading: true, recommendations: null });

    expect(screen.getByRole("status").textContent).toContain(
      "Calcul des recommandations du site",
    );
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("affiche l'erreur de l'API plutôt qu'une absence de conseil", () => {
    renderPanel({
      recommendations: null,
      error: "L'API métier est injoignable.",
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Recommandations indisponibles");
    expect(alert.textContent).toContain("L'API métier est injoignable.");
    // Une panne n'est pas un site sans risque : aucune liste, aucun « rien à
    // signaler ».
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("affiche le message de l'API tel qu'il est servi", () => {
    renderPanel();

    expect(
      screen.getByText("Pointe prévue à 18 h : décaler la charge du four si possible."),
    ).toBeDefined();
  });

  it("double la couleur de la sévérité par son niveau écrit", () => {
    renderPanel();

    expect(screen.getByText("élevée")).toBeDefined();
    expect(screen.getByText("pointe prévue")).toBeDefined();
  });

  it("traduit les trois natures d'action du contrat", () => {
    renderPanel({
      recommendations: makeRecommendations({
        items: [
          makeRecommendation({ type: "predicted_peak", severity: "low" }),
          makeRecommendation({ type: "capacity_overrun", severity: "critical" }),
          makeRecommendation({ type: "sensor_failure", severity: "medium" }),
        ],
      }),
    });

    expect(screen.getByText("pointe prévue")).toBeDefined();
    expect(screen.getByText("dépassement de puissance souscrite")).toBeDefined();
    expect(screen.getByText("panne de capteur")).toBeDefined();
    expect(screen.getByText("faible")).toBeDefined();
    expect(screen.getByText("critique")).toBeDefined();
    expect(screen.getByText("moyenne")).toBeDefined();
  });

  it("respecte l'ordre d'urgence servi par l'API", () => {
    renderPanel({
      recommendations: makeRecommendations({
        items: [
          makeRecommendation({ severity: "critical", message: "Première" }),
          makeRecommendation({ severity: "low", message: "Seconde" }),
        ],
      }),
    });

    const messages = screen
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(messages[0]).toContain("Première");
    expect(messages[1]).toContain("Seconde");
  });

  it("affiche la puissance en jeu et l'instant visé", () => {
    renderPanel();

    expect(screen.getByText(/480 kW/)).toBeDefined();
    expect(screen.getByText(/à 02\/09\/2026/)).toBeDefined();
  });

  it("affiche une plage quand l'action ne porte pas sur un instant", () => {
    renderPanel({
      recommendations: makeRecommendations({
        items: [
          makeRecommendation({
            at: null,
            window_start: "2026-09-02T18:00:00Z",
            window_end: "2026-09-02T20:00:00Z",
          }),
        ],
      }),
    });

    expect(screen.getByText(/de 02\/09\/2026.*à 02\/09\/2026/)).toBeDefined();
  });

  it("n'affiche aucune précision quand le contrat n'en sert aucune", () => {
    renderPanel({
      recommendations: makeRecommendations({
        items: [
          makeRecommendation({ value_kw: null, at: null, window_start: null, window_end: null }),
        ],
      }),
    });

    expect(screen.queryByText(/kW/)).toBeNull();
  });

  it("reprend la raison servie par l'API quand la liste est vide", () => {
    renderPanel({
      recommendations: makeRecommendations({
        items: [],
        detail: "Aucune prévision archivée sur l'horizon demandé.",
        model_version: null,
      }),
    });

    expect(
      screen.getByText("Aucune action à proposer sur les 24 prochaines heures."),
    ).toBeDefined();
    // « Aucun risque détecté » et « aucune prévision à examiner » ne se valent
    // pas : seule l'API sait lequel des deux s'applique.
    expect(
      screen.getByText("Aucune prévision archivée sur l'horizon demandé."),
    ).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("affiche la provenance des conseils, modèle compris", () => {
    renderPanel();

    expect(screen.getByText(/modèle enervision_xgboost:3/)).toBeDefined();
    expect(screen.getByText(/Sur 24 h de prévision/)).toBeDefined();
  });

  it("signale l'absence de version de modèle plutôt que de la taire", () => {
    renderPanel({ recommendations: makeRecommendations({ model_version: null }) });

    expect(screen.getByText(/aucune version de modèle servie/)).toBeDefined();
  });
});

describe("RecommendationsPanel · mode dégradé", () => {
  it("prévient quand les conseils ne s'appuient sur aucune prévision", () => {
    renderPanel({
      recommendations: makeRecommendations({
        model_version: null,
        items: [
          makeRecommendation({
            type: "sensor_failure",
            severity: "high",
            message: "Intervention capteur : fiabilité dégradée.",
            value_kw: null,
            at: null,
          }),
        ],
      }),
    });

    const bandeau = screen.getByRole("status");
    expect(bandeau.textContent).toContain("Mode dégradé");
    expect(bandeau.textContent).toContain("Aucune prévision n'a pu être examinée");
    // L'action reste affichée : c'est le seul conseil que l'API peut donner
    // sans modèle, et il est utile.
    expect(screen.getByText("Intervention capteur : fiabilité dégradée.")).toBeDefined();
  });

  it("n'affiche aucun bandeau quand un modèle fonde les conseils", () => {
    renderPanel();

    expect(screen.queryByText("Mode dégradé")).toBeNull();
  });

  it("n'affiche aucun bandeau sur une liste vide", () => {
    renderPanel({
      recommendations: makeRecommendations({ items: [], model_version: null }),
    });

    expect(screen.queryByText("Mode dégradé")).toBeNull();
  });
});
