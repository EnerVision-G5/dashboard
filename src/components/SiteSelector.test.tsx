import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SiteSelector } from "./SiteSelector";
import { makeSite } from "../test/doubles";

const SITES = [
  makeSite({ site_id: "SITE-001", site_name: "Usine Nantes Nord", location: "Nantes" }),
  makeSite({ site_id: "SITE-002", site_name: "Entrepôt Rezé", location: "Rezé" }),
];

describe("SiteSelector", () => {
  it("expose un champ étiqueté et sélectionnable au clavier", () => {
    render(
      <SiteSelector
        sites={SITES}
        selectedSiteId="SITE-001"
        onSelect={() => {}}
        isLoading={false}
      />,
    );

    const select = screen.getByLabelText("Site") as HTMLSelectElement;
    expect(select).toBeInstanceOf(HTMLSelectElement);
    expect(select.disabled).toBe(false);
    expect(select.value).toBe("SITE-001");
  });

  it("liste chaque site avec son nom et sa localisation", () => {
    render(
      <SiteSelector
        sites={SITES}
        selectedSiteId="SITE-001"
        onSelect={() => {}}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("option", { name: "Usine Nantes Nord — Nantes" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Entrepôt Rezé — Rezé" })).toBeDefined();
  });

  it("remonte l'identifiant du site choisi", () => {
    const onSelect = vi.fn();
    render(
      <SiteSelector
        sites={SITES}
        selectedSiteId="SITE-001"
        onSelect={onSelect}
        isLoading={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    expect(onSelect).toHaveBeenCalledWith("SITE-002");
  });

  it("annonce le chargement et reste inactif tant que les sites arrivent", () => {
    render(
      <SiteSelector sites={[]} selectedSiteId={null} onSelect={() => {}} isLoading />,
    );

    const select = screen.getByLabelText("Site") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(screen.getByRole("option", { name: "Chargement des sites…" })).toBeDefined();
  });

  it("signale un référentiel vide", () => {
    render(
      <SiteSelector
        sites={[]}
        selectedSiteId={null}
        onSelect={() => {}}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("option", { name: "Aucun site disponible" })).toBeDefined();
  });
});
