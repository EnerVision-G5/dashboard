import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ForecastAccuracyPanel } from "./ForecastAccuracyPanel";
import { makeSiteIndicators } from "../test/doubles";

const COMPARABLE = makeSiteIndicators().accuracy;

/** Le cas courant tant qu'aucune prévision n'a encore été mesurée. */
const SANS_PAIRE = makeSiteIndicators({
  accuracy: {
    ...COMPARABLE,
    paired_points: 0,
    bounded_points: 0,
    mae_kw: null,
    bias_kw: null,
    mean_actual_kw: null,
    within_bounds_ratio: null,
    drift: false,
    model_versions: [],
  },
}).accuracy;

describe("ForecastAccuracyPanel", () => {
  it("annonce le chargement", () => {
    render(<ForecastAccuracyPanel accuracy={null} isLoading error={null} />);

    expect(screen.getByRole("status").textContent).toContain(
      "Lecture de l'écart entre prévision et mesure",
    );
  });

  it("affiche l'erreur de l'API", () => {
    render(
      <ForecastAccuracyPanel
        accuracy={null}
        isLoading={false}
        error="L'API métier a renvoyé une erreur serveur (500)."
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Écart prédiction / réel indisponible",
    );
  });

  it("n'annonce pas l'absence de dérive quand rien n'a pu être comparé", () => {
    render(<ForecastAccuracyPanel accuracy={SANS_PAIRE} isLoading={false} error={null} />);

    expect(
      screen.getByText("Aucune prévision archivée n'a encore de mesure à laquelle se comparer."),
    ).toBeDefined();
    // Le contrat est explicite : drift à false sans paire ne veut pas dire
    // qu'il n'y a pas de dérive. Le panneau ne doit donc rien en conclure.
    expect(screen.queryByText(/Pas de dérive/)).toBeNull();
    expect(screen.queryByText(/Dérive/)).toBeNull();
  });

  it("affiche l'erreur moyenne et le biais dans l'unité du compteur", () => {
    render(<ForecastAccuracyPanel accuracy={COMPARABLE} isLoading={false} error={null} />);

    expect(screen.getByText("Erreur moyenne")).toBeDefined();
    expect(screen.getByText("8,0 kW")).toBeDefined();
    expect(screen.getByText("Biais")).toBeDefined();
    expect(screen.getByText("-2,0 kW")).toBeDefined();
  });

  it("traduit le sens du biais, ce qu'une erreur absolue ne dit pas", () => {
    render(<ForecastAccuracyPanel accuracy={COMPARABLE} isLoading={false} error={null} />);

    expect(screen.getByText("Le modèle sous-estime la consommation.")).toBeDefined();
  });

  it("traduit un biais positif en surestimation", () => {
    render(
      <ForecastAccuracyPanel
        accuracy={{ ...COMPARABLE, bias_kw: 15 }}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Le modèle surestime la consommation.")).toBeDefined();
  });

  it("rapporte la dérive au seuil servi par l'API", () => {
    render(
      <ForecastAccuracyPanel
        accuracy={{ ...COMPARABLE, mae_kw: 40, drift: true }}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText(/l'erreur moyenne dépasse 20 %/)).toBeDefined();
  });

  it("distingue « aucun intervalle annoncé » de « 0 % dans l'intervalle »", () => {
    render(
      <ForecastAccuracyPanel
        accuracy={{ ...COMPARABLE, within_bounds_ratio: null, bounded_points: 0 }}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("aucun intervalle annoncé")).toBeDefined();
    expect(screen.queryByText(/0 % sur/)).toBeNull();
  });

  it("nomme les modèles comparés", () => {
    render(
      <ForecastAccuracyPanel
        accuracy={{ ...COMPARABLE, model_versions: ["v1", "v2"] }}
        isLoading={false}
        error={null}
      />,
    );

    // Deux générations dans la fenêtre : le pluriel est accordé, et les deux
    // versions sont nommées plutôt que réduites à la plus récente.
    expect(screen.getByText(/Modèles comparés : v1, v2/)).toBeDefined();
  });
});
