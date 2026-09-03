import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card } from "./Card";
import { Alert } from "./Alert";
import { EmptyState, ErrorState, LoadingState } from "./states";

describe("Card", () => {
  it("relie la région à son titre, pour qu'un lecteur d'écran l'annonce par son nom", () => {
    render(<Card title="Consommation temps réel">contenu</Card>);

    const region = screen.getByRole("region", { name: "Consommation temps réel" });
    expect(region).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: "Consommation temps réel" })).toBeDefined();
  });

  it("reste une simple surface quand elle n'a pas de titre", () => {
    render(<Card>contenu</Card>);

    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByText("contenu")).toBeDefined();
  });

  it("affiche l'accroche sous le titre", () => {
    render(
      <Card title="Indicateurs" description="Sur les 24 dernières heures">
        contenu
      </Card>,
    );

    expect(screen.getByText("Sur les 24 dernières heures")).toBeDefined();
  });

  it("accueille une commande à droite du titre", () => {
    render(
      <Card title="Indicateurs" action={<button type="button">Exporter</button>}>
        contenu
      </Card>,
    );

    expect(screen.getByRole("button", { name: "Exporter" })).toBeDefined();
  });
});

describe("les quatre états", () => {
  it("annonce le chargement poliment, sans interrompre la lecture", () => {
    render(<LoadingState>Chargement de la dernière mesure…</LoadingState>);

    expect(screen.getByRole("status").textContent).toBe("Chargement de la dernière mesure…");
  });

  it("annonce l'erreur immédiatement, et nomme ce qui a échoué", () => {
    render(<ErrorState title="Mesures indisponibles">L'API métier est injoignable.</ErrorState>);

    const alerte = screen.getByRole("alert");
    expect(alerte.textContent).toContain("Mesures indisponibles");
    expect(alerte.textContent).toContain("L'API métier est injoignable.");
  });

  it("explique pourquoi c'est vide plutôt que de dire « aucune donnée »", () => {
    render(
      <EmptyState detail="La route est prévue au contrat 1.2.0.">
        Aucune recommandation n'est disponible.
      </EmptyState>,
    );

    expect(screen.getByText("Aucune recommandation n'est disponible.")).toBeDefined();
    expect(screen.getByText("La route est prévue au contrat 1.2.0.")).toBeDefined();
  });

  it("n'impose pas de détail à un état vide qui se suffit", () => {
    render(<EmptyState>Aucune mesure connue pour ce site.</EmptyState>);

    expect(screen.getByText("Aucune mesure connue pour ce site.")).toBeDefined();
  });
});

describe("Alert", () => {
  it("porte le sens par son libellé autant que par sa couleur", () => {
    render(
      <Alert tone="avertissement" label="Données de démonstration">
        La prédiction provient d'un JSON figé.
      </Alert>,
    );

    expect(screen.getByText("Données de démonstration")).toBeDefined();
    expect(screen.getByRole("status").textContent).toContain("JSON figé");
  });

  it("interrompt la lecture pour une erreur, pas pour un avertissement", () => {
    const { unmount } = render(
      <Alert tone="erreur" label="Panne">
        Service injoignable.
      </Alert>,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    unmount();

    render(
      <Alert tone="information" label="Info">
        Rien de grave.
      </Alert>,
    );
    expect(screen.getByRole("status")).toBeDefined();
  });
});
