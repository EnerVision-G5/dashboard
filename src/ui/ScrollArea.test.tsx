import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScrollArea } from "./ScrollArea";

describe("ScrollArea", () => {
  it("nomme la région, sans quoi un lecteur d'écran ne dirait pas de quoi elle parle", () => {
    render(
      <ScrollArea label="Liste des alertes">
        <p>contenu</p>
      </ScrollArea>,
    );

    const zone = screen.getByRole("region", { name: "Liste des alertes" });
    expect(zone.textContent).toBe("contenu");
  });

  it("est atteignable au clavier", () => {
    render(
      <ScrollArea label="Zone">
        <p>contenu</p>
      </ScrollArea>,
    );

    // Sans cela, le contenu qui dépasse est inaccessible à qui n'utilise pas
    // la souris : la zone défile, mais rien ne peut lui donner le focus.
    expect(screen.getByRole("region").getAttribute("tabindex")).toBe("0");
  });

  it("borne sa hauteur et laisse défiler", () => {
    render(
      <ScrollArea label="Zone">
        <p>contenu</p>
      </ScrollArea>,
    );

    const classes = screen.getByRole("region").className;
    expect(classes).toContain("overflow-y-auto");
    expect(classes).toContain("max-h-72");
  });

  it("accepte les trois hauteurs de l'échelle", () => {
    const { rerender } = render(
      <ScrollArea label="Zone" height="courte">
        <p>contenu</p>
      </ScrollArea>,
    );
    expect(screen.getByRole("region").className).toContain("max-h-48");

    rerender(
      <ScrollArea label="Zone" height="haute">
        <p>contenu</p>
      </ScrollArea>,
    );
    expect(screen.getByRole("region").className).toContain("max-h-96");
  });
});
