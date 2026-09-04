import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigPage } from "./ConfigPage";

describe("ConfigPage", () => {
  it("rend la région de configuration", () => {
    render(<ConfigPage />);

    expect(screen.getByRole("heading", { name: "Configuration", level: 2 })).toBeDefined();
  });

  it("annonce un écran sans paramètre plutôt que des réglages inventés", () => {
    render(<ConfigPage />);

    expect(
      screen.getByText("Aucun paramètre n'est encore modifiable depuis cet écran."),
    ).toBeDefined();
    expect(screen.getByText(/EV-55/)).toBeDefined();
    // Aucun réglage ne peut être proposé tant que le contrat ne publie aucune
    // route de configuration : un formulaire ici promettrait une persistance
    // qui n'existe pas.
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
