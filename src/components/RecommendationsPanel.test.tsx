import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RECOMMENDATIONS_TICKET, RecommendationsPanel } from "./RecommendationsPanel";

describe("RecommendationsPanel", () => {
  it("tient sa place dans la mise en page avec un titre lisible", () => {
    render(<RecommendationsPanel />);

    expect(screen.getByRole("heading", { name: "Recommandations", level: 2 })).toBeDefined();
  });

  it("dit que l'API n'en publie pas encore plutôt que d'inventer des conseils", () => {
    render(<RecommendationsPanel />);

    expect(screen.getByText(/Aucune recommandation n'est disponible/)).toBeDefined();
    expect(screen.getByText(new RegExp(RECOMMENDATIONS_TICKET))).toBeDefined();
  });

  it("n'affiche aucune liste de recommandations", () => {
    render(<RecommendationsPanel />);

    expect(screen.queryByRole("list")).toBeNull();
  });
});
