import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MISSING_VALUE, MetricTile } from "./MetricTile";

describe("MetricTile", () => {
  it("formate la valeur à la française, avec son unité", () => {
    render(<MetricTile label="Consommation" value={2654} unit="kW" digits={0} />);

    expect(screen.getByText("2 654 kW")).toBeDefined();
  });

  it("respecte le nombre de décimales demandé", () => {
    render(<MetricTile label="Tension" value={401.234} unit="V" digits={1} />);

    expect(screen.getByText("401,2 V")).toBeDefined();
  });

  it("affiche une valeur absente comme absente, jamais comme un zéro", () => {
    render(<MetricTile label="Tension" value={null} unit="V" />);

    expect(screen.getByText(MISSING_VALUE)).toBeDefined();
    expect(screen.queryByText("0 V")).toBeNull();
  });

  it("distingue un zéro mesuré d'une absence de mesure", () => {
    render(<MetricTile label="Consommation" value={0} unit="kW" digits={0} />);

    expect(screen.getByText("0 kW")).toBeDefined();
    expect(screen.queryByText(MISSING_VALUE)).toBeNull();
  });

  it("marque la valeur pour les chiffres tabulaires", () => {
    const { container } = render(<MetricTile label="Consommation" value={120} unit="kW" />);

    expect(container.querySelector("[data-valeur]")?.textContent).toBe("120,0 kW");
  });

  it("n'annonce pas la valeur comme une région live", () => {
    // <output> porterait un rôle status implicite : cinq tuiles rafraîchies
    // toutes les trente secondes noieraient un lecteur d'écran sous les
    // annonces. Une valeur affichée n'est pas un événement.
    const { container } = render(<MetricTile label="Consommation" value={120} unit="kW" />);

    expect(container.querySelector("output")).toBeNull();
    expect(container.querySelector("[role='status']")).toBeNull();
  });

  it("grossit la valeur principale sans changer les secondaires", () => {
    const { container, rerender } = render(
      <MetricTile label="Consommation" value={120} unit="kW" emphasis="principal" />,
    );
    expect(container.querySelector("[data-valeur]")?.className).toContain("text-valeur-xl");

    rerender(<MetricTile label="Tension" value={400} unit="V" />);
    expect(container.querySelector("[data-valeur]")?.className).toContain("text-valeur-l");
  });

  it("affiche le libellé de la grandeur", () => {
    render(<MetricTile label="Humidité" value={58.4} unit="%" />);

    expect(screen.getByText("Humidité")).toBeDefined();
  });
});
