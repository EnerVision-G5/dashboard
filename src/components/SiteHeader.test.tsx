import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SiteHeader } from "./SiteHeader";
import { makeSite } from "../test/doubles";

const SITE_A = makeSite({
  site_id: "SITE-001",
  site_name: "Usine Nantes Nord",
  capacity_kw: 500,
});
const SITE_B = makeSite({
  site_id: "SITE-002",
  site_name: "Entrepôt Rezé",
  location: "Rezé",
});

function renderHeader(
  overrides: Partial<React.ComponentProps<typeof SiteHeader>> = {},
) {
  const onSelect = vi.fn();
  render(
    <SiteHeader
      sites={[SITE_A, SITE_B]}
      selectedSite={SITE_A}
      onSelect={onSelect}
      isLoading={false}
      {...overrides}
    />,
  );
  return { onSelect };
}

describe("SiteHeader", () => {
  it("porte le sélecteur de site", () => {
    renderHeader();

    expect((screen.getByLabelText("Site") as HTMLSelectElement).value).toBe("SITE-001");
  });

  it("remonte le site choisi", () => {
    const { onSelect } = renderHeader();

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    expect(onSelect).toHaveBeenCalledWith("SITE-002");
  });

  it("affiche la puissance souscrite et l'identité du site", () => {
    renderHeader();

    expect(screen.getByText("Puissance souscrite 500 kW")).toBeDefined();
    expect(screen.getByText(/Nantes · usine · active/)).toBeDefined();
  });

  it("n'affiche aucune identité tant qu'aucun site n'est choisi", () => {
    renderHeader({ selectedSite: null });

    expect(screen.queryByText(/Puissance souscrite/)).toBeNull();
  });

  it("reste collé en haut de l'écran", () => {
    renderHeader();

    // L'écran est long : sans cet en-tête sous les yeux, on descend dans les
    // alertes ou les diagnostics sans plus savoir de quel site ils parlent.
    const entete = screen.getByRole("banner");
    expect(entete.className).toContain("sticky");
    expect(entete.className).toContain("top-0");
    // Le contenu défile dessous : un fond transparent le laisserait paraître.
    expect(entete.className).toContain("bg-white");
  });
});
