import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ACTUAL_SERIES_LABEL,
  BRIDGE_SERIES_LABEL,
  ConsumptionPredictionChart,
  PREDICTED_SERIES_LABEL,
  SeriesTooltip,
} from "./ConsumptionPredictionChart";
import type { ChartPoint } from "../lib/series";
import { buildChartSeries } from "../lib/series";
import { measureOf } from "../lib/measures";
import { makePredictionPoint, makeReading } from "../test/doubles";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedSizeContainer } = await import("../test/rechartsMock");
  return withFixedSizeContainer(await importOriginal());
});

const POINTS = buildChartSeries(
  [
    makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 100 }),
    makeReading({ timestamp: "2026-09-02T01:00:00Z", consumption_kw: null }),
    makeReading({ timestamp: "2026-09-02T02:00:00Z", consumption_kw: 110 }),
  ],
  [
    makePredictionPoint({ timestamp: "2026-09-02T03:00:00Z", predicted_consumption_kw: 120 }),
    makePredictionPoint({ timestamp: "2026-09-02T04:00:00Z", predicted_consumption_kw: 125 }),
  ],
);

describe("ConsumptionPredictionChart", () => {
  it("affiche les deux séries et leurs libellés dans la légende", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    expect(screen.getByText(ACTUAL_SERIES_LABEL)).toBeDefined();
    expect(screen.getByText(PREDICTED_SERIES_LABEL)).toBeDefined();
    // Trois traits depuis le pontage des trous : mesuré, joint, prédit.
    expect(screen.getByText(BRIDGE_SERIES_LABEL)).toBeDefined();
    expect(container.querySelectorAll(".recharts-line-curve").length).toBe(3);
  });

  it("distingue la prédiction par un tracé en pointillés", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    // Le pontage est aussi en pointillé : on vise donc la série nommée,
    // plutôt que "la seule courbe pointillée du graphique".
    const predite = container.querySelector(".serie-predite .recharts-line-curve");
    expect(predite?.getAttribute("stroke-dasharray")).toBe("6 4");
    const mesuree = container.querySelector(".serie-mesuree .recharts-line-curve");
    expect(mesuree?.getAttribute("stroke-dasharray")).toBeNull();
  });

  it("porte une description accessible", () => {
    render(
      <ConsumptionPredictionChart points={POINTS} description="Consommation du site SITE-001" />,
    );

    expect(screen.getByRole("img", { name: "Consommation du site SITE-001" })).toBeDefined();
  });

  it("interrompt la courbe réelle sur une mesure absente au lieu de la combler", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    const actualCurve = container.querySelector(".serie-mesuree .recharts-line-curve");
    // Un trou se traduit par une reprise de tracé (« M ») en milieu de chemin ;
    // une courbe comblée n'en contiendrait qu'une, au départ.
    const path = actualCurve?.getAttribute("d") ?? "";
    expect((path.match(/M/g) ?? []).length).toBeGreaterThan(1);
  });
});

describe("ConsumptionPredictionChart · pontage des trous", () => {
  it("relie la dernière valeur connue à la suivante", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    // Un seul « M » : le tracé ne s'interrompt pas, il traverse le trou.
    const pontage = container.querySelector(".serie-pontage .recharts-line-curve");
    const chemin = pontage?.getAttribute("d") ?? "";
    expect((chemin.match(/M/g) ?? []).length).toBe(1);
  });

  it("se distingue de la mesure par un trait fin et atténué", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    // La forme porte la différence : combler avec le trait plein de la mesure
    // aurait affirmé une continuité que personne n'a relevée.
    const pontage = container.querySelector(".serie-pontage .recharts-line-curve");
    expect(pontage?.getAttribute("stroke-dasharray")).toBe("2 4");
    expect(pontage?.getAttribute("stroke-width")).toBe("1");
    expect(pontage?.getAttribute("stroke-opacity")).toBe("0.45");
  });

});

describe("ConsumptionPredictionChart · grandeur tracée", () => {
  it("trace la consommation et sa prédiction par défaut", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={POINTS} description="Graphique de test" />,
    );

    expect(screen.getByText(ACTUAL_SERIES_LABEL)).toBeDefined();
    expect(screen.getByText(PREDICTED_SERIES_LABEL)).toBeDefined();
    expect(container.querySelector(".serie-predite")).not.toBeNull();
  });

  it("n'affiche aucune courbe prédite sur une grandeur non prédite", () => {
    const { container } = render(
      <ConsumptionPredictionChart
        points={POINTS}
        measure={measureOf("temperature")}
        description="Graphique de test"
      />,
    );

    // Le modèle ne prévoit que la consommation : afficher une courbe vide
    // laisserait croire à une prévision manquante.
    expect(container.querySelector(".serie-predite")).toBeNull();
    expect(screen.queryByText(PREDICTED_SERIES_LABEL)).toBeNull();
    expect(screen.getByText("Température (°C)")).toBeDefined();
  });

  it("garde la mesure et son pontage sur une autre grandeur", () => {
    const { container } = render(
      <ConsumptionPredictionChart
        points={POINTS}
        measure={measureOf("voltage")}
        description="Graphique de test"
      />,
    );

    expect(container.querySelector(".serie-mesuree .recharts-line-curve")).not.toBeNull();
    expect(container.querySelector(".serie-pontage .recharts-line-curve")).not.toBeNull();
  });
});

describe("ConsumptionPredictionChart · prédiction à pas horaire", () => {
  /**
   * Ce que l'API sert : des mesures fréquentes, une prévision par heure. Le
   * pas des mesures est ici de dix minutes plutôt qu'une — assez pour que des
   * points sans prévision séparent les points prédits, sans faire rendre à
   * jsdom des centaines d'éléments.
   */
  const PAS_DIFFERENTS = buildChartSeries(
    Array.from({ length: 19 }, (_, index) =>
      makeReading({
        timestamp: new Date(Date.UTC(2026, 8, 8, 11, index * 10, 3)).toISOString(),
        consumption_kw: 150 + index,
      }),
    ),
    Array.from({ length: 3 }, (_, heure) =>
      makePredictionPoint({
        timestamp: new Date(Date.UTC(2026, 8, 8, 11 + heure, 0, 0)).toISOString(),
        predicted_consumption_kw: 200 + heure,
      }),
    ),
  );

  it("trace la prévision malgré les instants sans point prédit", () => {
    const { container } = render(
      <ConsumptionPredictionChart points={PAS_DIFFERENTS} description="Graphique de test" />,
    );

    // Sans connectNulls, Recharts ne trouvait jamais deux points prédits
    // consécutifs : la courbe se réduisait à des segments de longueur nulle,
    // invisibles faute de points. La prédiction disparaissait du graphique
    // alors que l'API la servait.
    const predite = container.querySelector(".serie-predite .recharts-line-curve");
    const chemin = predite?.getAttribute("d") ?? "";
    expect(chemin).not.toBe("");
    expect((chemin.match(/M/g) ?? []).length).toBe(1);
    // Trois points reliés, donc au moins deux segments dans le tracé.
    expect((chemin.match(/[LC]/g) ?? []).length).toBeGreaterThan(0);
  });

  it("laisse la courbe mesurée interrompue, elle", () => {
    const avecTrou = buildChartSeries(
      [
        makeReading({ timestamp: "2026-09-08T11:00:03Z", consumption_kw: 150 }),
        makeReading({ timestamp: "2026-09-08T11:01:03Z", consumption_kw: null }),
        makeReading({ timestamp: "2026-09-08T11:02:03Z", consumption_kw: 152 }),
      ],
      [],
    );

    const { container } = render(
      <ConsumptionPredictionChart points={avecTrou} description="Graphique de test" />,
    );

    // Les deux séries n'ont pas la même règle, et c'est délibéré : une mesure
    // absente est un trou, un instant sans prévision n'en est pas un.
    const mesuree = container.querySelector(".serie-mesuree .recharts-line-curve");
    const chemin = mesuree?.getAttribute("d") ?? "";
    expect((chemin.match(/M/g) ?? []).length).toBeGreaterThan(1);
  });
});
describe("SeriesTooltip · prévision rapprochée", () => {
  /** Mesures à la minute, prévisions à l'heure : aucun horodatage commun. */
  const SERIE = buildChartSeries(
    Array.from({ length: 120 }, (_, minute) =>
      makeReading({
        timestamp: new Date(Date.UTC(2026, 8, 8, 11, minute, 3)).toISOString(),
        consumption_kw: 150,
      }),
    ),
    [
      makePredictionPoint({
        timestamp: "2026-09-08T12:00:00Z",
        predicted_consumption_kw: 220,
      }),
    ],
  );

  /** Heure locale de la prévision, celle que l'infobulle doit rappeler. */
  const HEURE_PREVISION = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date("2026-09-08T12:00:00Z"));

  const pointA = (heure: number, minute: number) => {
    const instant = Date.UTC(2026, 8, 8, heure, minute, 3);
    const point = SERIE.find((candidat) => candidat.timestamp === instant);
    if (point === undefined) {
      throw new Error(`aucun point à ${heure} h ${minute}`);
    }
    return point;
  };

  /**
   * Le texte de l'infobulle, recomposé.
   *
   * Les lignes sont fragmentées en plusieurs nœuds par l'interpolation JSX :
   * une recherche par nœud manquerait la phrase que l'utilisateur lit.
   */
  const survoler = (point: ChartPoint, measure = measureOf("consumption")) =>
    render(
      <SeriesTooltip
        active
        payload={[{ payload: point }]}
        measure={measure}
        points={SERIE}
      />,
    ).container.textContent ?? "";

  it("montre la prévision de l'heure voisine sur une mesure", () => {
    // Le défaut signalé : la courbe prédite passait au-dessus de la mesure
    // survolée, et l'infobulle n'en disait rien.
    expect(survoler(pointA(11, 59))).toContain("Prédiction (kW) : 220.0 kW");
  });

  it("rappelle l'heure de la prévision, distincte de l'instant survolé", () => {
    expect(survoler(pointA(11, 59))).toContain(`(prévision de ${HEURE_PREVISION})`);
  });

  it("n'invente rien là où aucune prévision n'approche", () => {
    // 11 h 05 est à cinquante-cinq minutes de la seule prévision : la
    // rattacher comparerait la mesure à une autre heure.
    const texte = survoler(pointA(11, 5));

    expect(texte).toContain("Prédiction (kW) : —");
    expect(texte).not.toContain("prévision de");
  });

  it("n'ajoute pas l'heure quand la prévision est celle du point survolé", () => {
    const predit = SERIE.find((point) => point.isoTimestamp === "2026-09-08T12:00:00Z");
    expect(predit).toBeDefined();
    const texte = survoler(predit as ChartPoint);

    expect(texte).toContain("Prédiction (kW) : 220.0 kW");
    expect(texte).not.toContain("prévision de");
  });

  it("ne parle pas de prédiction sur une grandeur qui n'en a pas", () => {
    expect(survoler(pointA(11, 59), measureOf("voltage"))).not.toContain("Prédiction");
  });
});
