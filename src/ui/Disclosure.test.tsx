import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("est replié par défaut", () => {
    render(
      <Disclosure summary="Collecteur">
        <p>détail</p>
      </Disclosure>,
    );

    expect(screen.getByRole("group").hasAttribute("open")).toBe(false);
  });

  it("garde son contenu dans le DOM une fois replié", () => {
    render(
      <Disclosure summary="Collecteur">
        <p>détail</p>
      </Disclosure>,
    );

    // Ce que la recherche du navigateur (Ctrl+F) sait d'ailleurs ouvrir, et
    // ce qui permet aux tests de vérifier un contenu replié.
    expect(screen.getByText("détail")).toBeDefined();
  });

  it("s'ouvre d'emblée quand le contenu est le sujet du panneau", () => {
    render(
      <Disclosure summary="Collecteur" defaultOpen>
        <p>détail</p>
      </Disclosure>,
    );

    expect(screen.getByRole("group").hasAttribute("open")).toBe(true);
  });

  it("s'ouvre et se referme au clic sur son résumé", () => {
    render(
      <Disclosure summary="Collecteur">
        <p>détail</p>
      </Disclosure>,
    );
    const bloc = screen.getByRole("group");

    fireEvent.click(screen.getByText("Collecteur"));
    expect(bloc.hasAttribute("open")).toBe(true);

    fireEvent.click(screen.getByText("Collecteur"));
    expect(bloc.hasAttribute("open")).toBe(false);
  });
});
