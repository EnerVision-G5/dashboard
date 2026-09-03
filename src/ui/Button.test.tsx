import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("rend un bouton de type button, pour ne pas soumettre un formulaire par accident", () => {
    render(<Button>Enregistrer</Button>);

    expect(screen.getByRole("button", { name: "Enregistrer" }).getAttribute("type")).toBe("button");
  });

  it("accepte le type submit quand on le demande explicitement", () => {
    render(<Button type="submit">Se connecter</Button>);

    expect(screen.getByRole("button", { name: "Se connecter" }).getAttribute("type")).toBe("submit");
  });

  it("remonte le clic", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Agir</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Agir" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("remplace le libellé pendant le chargement et verrouille le bouton", () => {
    render(
      <Button isLoading loadingLabel="Connexion en cours…">
        Se connecter
      </Button>,
    );

    const bouton = screen.getByRole("button", { name: "Connexion en cours…" });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
    expect(bouton.getAttribute("aria-busy")).toBe("true");
  });

  it("masque les doublures de largeur aux technologies d'assistance", () => {
    render(
      <Button isLoading loadingLabel="Connexion en cours…">
        Se connecter
      </Button>,
    );

    // Le nom accessible ne contient que le libellé courant, pas les doublures.
    expect(screen.getByRole("button").textContent).toContain("Se connecter");
    expect(screen.getByRole("button", { name: "Connexion en cours…" })).toBeDefined();
  });

  it("n'annonce pas aria-busy hors chargement", () => {
    render(<Button>Agir</Button>);

    expect(screen.getByRole("button").getAttribute("aria-busy")).toBeNull();
  });

  it("ne déclenche rien quand il est désactivé", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Agir
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agir" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("porte une classe par variante, sans les mélanger", () => {
    const { rerender } = render(<Button variant="principal">Agir</Button>);
    expect(screen.getByRole("button").className).toContain("bg-mesure-700");

    rerender(<Button variant="danger">Agir</Button>);
    expect(screen.getByRole("button").className).toContain("bg-alerte-700");
    expect(screen.getByRole("button").className).not.toContain("bg-mesure-700");
  });

  it("respecte la cible de pointage minimale de 36 px en taille md", () => {
    render(<Button>Agir</Button>);

    expect(screen.getByRole("button").className).toContain("min-h-9");
  });
});
