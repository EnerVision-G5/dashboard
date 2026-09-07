import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataQualityBarChart } from "./DataQualityBarChart";
import { buildChartSeries } from "../lib/series";
import { makePredictionPoint, makeReading } from "../test/doubles";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedSizeContainer } = await import("../test/rechartsMock");
  return withFixedSizeContainer(await importOriginal());
});

const MELANGE = buildChartSeries(
  [
    makeReading({ timestamp: "2026-09-02T00:00:00Z", data_quality: "good" }),
    makeReading({ timestamp: "2026-09-02T00:01:00Z", data_quality: "good" }),
    makeReading({ timestamp: "2026-09-02T00:02:00Z", data_quality: "degraded" }),
    makeReading({ timestamp: "2026-09-02T00:03:00Z", data_quality: "critical" }),
  ],
  [],
);

describe("DataQualityBarChart", () => {
  it("rend un graphique décrit pour les technologies d'assistance", () => {
    render(<DataQualityBarChart points={MELANGE} />);

    const graphique = screen.getByRole("img");
    // Le contenu SVG de Recharts n'est pas lisible autrement : la description
    // porte les chiffres, pas seulement le titre.
    expect(graphique.getAttribute("aria-label")).toContain("Répartition des 4 mesures");
    expect(graphique.getAttribute("aria-label")).toContain("2 bonne");
    expect(graphique.getAttribute("aria-label")).toContain("1 dégradée");
  });

  it("nomme les quatre catégories sur l'axe, même celles à zéro", () => {
    render(<DataQualityBarChart points={MELANGE} />);

    // Recharts ajoute au body un span de mesure qui reprend les mêmes
    // textes : on regarde donc dans le graphique, pas dans le document.
    const graphique = within(screen.getByRole("img"));
    // Une barre absente et une barre vide ne disent pas la même chose : la
    // catégorie « partielle » reste affichée à zéro.
    for (const label of ["bonne", "partielle", "dégradée", "critique"]) {
      expect(graphique.getByText(label)).toBeDefined();
    }
  });

  it("écrit le nombre au bout de chaque barre", () => {
    render(<DataQualityBarChart points={MELANGE} />);

    // Sur une fenêtre où une catégorie écrase les autres, les petites barres
    // seraient illisibles à l'échelle. Les graduations de l'axe portent les
    // mêmes chiffres : on lit donc les étiquettes de barres elles-mêmes.
    const etiquettes = screen
      .getByRole("img")
      .querySelectorAll(".recharts-label-list text");
    // Recharts n'écrit pas d'étiquette sur une barre de largeur nulle : la
    // catégorie à zéro reste nommée sur l'axe (test précédent) mais ne porte
    // pas de chiffre.
    expect([...etiquettes].map((noeud) => noeud.textContent)).toEqual(["2", "1", "1"]);
  });

  it("annonce l'absence de mesure plutôt qu'un graphique vide", () => {
    render(<DataQualityBarChart points={[]} />);

    expect(
      screen.getByText("Aucune mesure qualifiée sur la fenêtre : rien à répartir."),
    ).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("ne qualifie pas une prévision comme une mesure", () => {
    const prevuSeul = buildChartSeries([], [makePredictionPoint()]);

    render(<DataQualityBarChart points={prevuSeul} />);

    // Aucune mesure ne correspond à ces points : leur qualité est nulle, et
    // les compter reviendrait à qualifier une prévision.
    expect(
      screen.getByText("Aucune mesure qualifiée sur la fenêtre : rien à répartir."),
    ).toBeDefined();
  });
});
