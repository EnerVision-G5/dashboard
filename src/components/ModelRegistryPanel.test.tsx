import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ModelRegistryPanel } from "./ModelRegistryPanel";
import { makeModel } from "../test/doubles";

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ModelRegistryPanel>> = {},
) {
  render(
    <ModelRegistryPanel
      current={makeModel()}
      models={[makeModel()]}
      isLoading={false}
      error={null}
      currentError={null}
      {...overrides}
    />,
  );
}

describe("ModelRegistryPanel", () => {
  it("annonce le chargement", () => {
    renderPanel({ isLoading: true });

    expect(screen.getByRole("status").textContent).toContain(
      "Lecture du registre des modèles",
    );
  });

  it("détaille le modèle promu", () => {
    renderPanel();

    expect(screen.getByText("Modèle promu")).toBeDefined();
    expect(screen.getByText("enervision_xgboost · 3")).toBeDefined();
    // Les deux dates ne se confondent pas : entraînement et entrée au registre.
    expect(screen.getByText("Entraîné le")).toBeDefined();
    expect(screen.getByText("Entré au registre le")).toBeDefined();
  });

  it("tronque le run MLflow à l'affichage mais garde la valeur entière", () => {
    renderPanel();

    const run = screen.getByText("9f2c1ab4d5e6…");
    expect(run.getAttribute("title")).toBe("9f2c1ab4d5e6789012345678abcdef01");
  });

  it("traite l'absence de modèle promu comme une information, pas une panne", () => {
    renderPanel({ current: null, models: [] });

    expect(screen.getByText("Aucun modèle n'est promu actuellement.")).toBeDefined();
    expect(screen.getByText(/répond 503 tant qu'aucun modèle n'est publié/)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche une erreur quand la lecture du modèle promu échoue vraiment", () => {
    renderPanel({
      current: null,
      currentError: "L'API métier a renvoyé une erreur serveur (500).",
    });

    expect(screen.getByRole("alert").textContent).toContain("Modèle promu indisponible");
    expect(screen.queryByText("Aucun modèle n'est promu actuellement.")).toBeNull();
  });

  it("ne répète pas le modèle promu dans les versions précédentes", () => {
    renderPanel();

    expect(screen.getByText("Aucune version antérieure au registre.")).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("liste les versions antérieures quand il y en a", () => {
    renderPanel({
      models: [
        makeModel(),
        makeModel({ modele_id: 2, version: "2", date_entrainement: "2026-08-01T02:00:00Z" }),
      ],
    });

    expect(screen.getByText("Versions précédentes")).toBeDefined();
    expect(screen.getByText("enervision_xgboost · 2")).toBeDefined();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("garde le modèle promu affiché quand seul le registre échoue", () => {
    renderPanel({
      models: [],
      error: "L'API métier est injoignable.",
    });

    expect(screen.getByText("enervision_xgboost · 3")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain(
      "Registre des modèles indisponible",
    );
  });
});
