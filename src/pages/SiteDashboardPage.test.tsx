import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SiteDashboardPage } from "./SiteDashboardPage";
import { ApiError } from "../api/http";
import {
  makePrediction,
  makePredictionPoint,
  makeReading,
  makeSite,
} from "../test/doubles";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedSizeContainer } = await import("../test/rechartsMock");
  return withFixedSizeContainer(await importOriginal());
});

const fetchSites = vi.hoisted(() => vi.fn());
const fetchReadings = vi.hoisted(() => vi.fn());
const fetchPrediction = vi.hoisted(() => vi.fn());

vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  fetchSites,
}));
vi.mock("../api/readings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/readings")>()),
  fetchReadings,
}));
vi.mock("../api/predictions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/predictions")>()),
  fetchPrediction,
}));

const SITE_A = makeSite({ site_id: "SITE-001", site_name: "Usine Nantes Nord", status: "active" });
const SITE_B = makeSite({
  site_id: "SITE-002",
  site_name: "Entrepôt Rezé",
  location: "Rezé",
  status: "active",
});

function readingsOf(siteId: string, kw: number) {
  return [
    makeReading({ site_id: siteId, timestamp: "2026-09-02T00:00:00Z", consumption_kw: kw }),
    makeReading({ site_id: siteId, timestamp: "2026-09-02T01:00:00Z", consumption_kw: kw + 1 }),
  ];
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubEnv("VITE_PREDICT_BASE_URL", "http://predict.test");
  fetchSites.mockResolvedValue([SITE_A, SITE_B]);
  fetchReadings.mockResolvedValue(readingsOf("SITE-001", 100));
  fetchPrediction.mockResolvedValue(
    makePrediction({
      points: [
        makePredictionPoint({
          timestamp: "2026-09-02T02:00:00Z",
          predicted_consumption_kw: 130,
        }),
      ],
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("SiteDashboardPage", () => {
  it("affiche un état de chargement avant l'arrivée des sites", () => {
    render(<SiteDashboardPage />);

    expect((screen.getByLabelText("Site") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole("option", { name: "Chargement des sites…" })).toBeDefined();
  });

  it("sélectionne le premier site actif et trace les deux séries", async () => {
    render(<SiteDashboardPage />);

    await screen.findByRole("heading", { name: "Usine Nantes Nord", level: 2 });
    expect((screen.getByLabelText("Site") as HTMLSelectElement).value).toBe("SITE-001");
    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    expect(screen.getByText("Prédiction (kW)")).toBeDefined();
    expect(fetchReadings).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
    expect(fetchPrediction).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("recharge les deux flux au changement de site sans réutiliser les données du précédent", async () => {
    render(<SiteDashboardPage />);
    await screen.findByText("Consommation réelle (kW)");

    let resolveReadings: (value: unknown) => void = () => {};
    fetchReadings.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReadings = resolve;
        }),
    );
    fetchPrediction.mockResolvedValue(makePrediction({ site_id: "SITE-002", points: [] }));

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    // Pendant le rechargement, l'écran montre le nouveau site en chargement et
    // plus aucune trace du graphique précédent.
    await screen.findByRole("heading", { name: "Entrepôt Rezé", level: 2 });
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Entrepôt Rezé");
    });
    expect(screen.queryByText("Consommation réelle (kW)")).toBeNull();

    resolveReadings(readingsOf("SITE-002", 200));
    await waitFor(() => {
      expect(screen.getByText("Consommation réelle (kW)")).toBeDefined();
    });
    expect(fetchReadings).toHaveBeenLastCalledWith(
      expect.objectContaining({ siteId: "SITE-002" }),
    );
  });

  it("annonce une fenêtre sans donnée plutôt qu'un graphique vide", async () => {
    fetchReadings.mockResolvedValue([]);
    fetchPrediction.mockResolvedValue(makePrediction({ points: [] }));

    render(<SiteDashboardPage />);

    expect(
      await screen.findByText(/Aucune donnée à afficher pour ce site/),
    ).toBeDefined();
  });

  it("signale un référentiel de sites vide", async () => {
    fetchSites.mockResolvedValue([]);

    render(<SiteDashboardPage />);

    expect(
      await screen.findByText("Aucun site n'est encore supervisé par l'API métier."),
    ).toBeDefined();
  });

  it("affiche l'erreur de l'API métier sans remplacer les mesures", async () => {
    fetchReadings.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    render(<SiteDashboardPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Mesures indisponibles");
    expect(alert.textContent).toContain("L'API métier est injoignable.");
  });

  it("garde les mesures affichées quand seule la prédiction échoue", async () => {
    fetchPrediction.mockRejectedValue(
      new ApiError("Le service d'inférence n'implémente pas encore cet endpoint (501).", 501),
    );

    render(<SiteDashboardPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Prédiction indisponible");
    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    expect(screen.getByText("Aucun point de prédiction sur la fenêtre.")).toBeDefined();
  });

  it("n'appelle pas le service d'inférence et affiche le bandeau en mode fixture", async () => {
    vi.stubEnv("VITE_PREDICTION_SOURCE", "fixture");

    render(<SiteDashboardPage />);

    const badge = await screen.findByText("Données de démonstration");
    expect(badge).toBeDefined();
    expect(
      screen.getByText(/La courbe de prédiction provient d'un JSON figé/),
    ).toBeDefined();
    expect(await screen.findByText("Prédiction (kW)")).toBeDefined();
    expect(fetchPrediction).not.toHaveBeenCalled();
  });

  it("ne bascule jamais sur le JSON de démonstration quand l'appel réel échoue", async () => {
    fetchPrediction.mockRejectedValue(
      new ApiError("Le service d'inférence n'implémente pas encore cet endpoint (501).", 501),
    );

    render(<SiteDashboardPage />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("501");
    expect(screen.queryByText("Données de démonstration")).toBeNull();
    expect(screen.getByText("Aucun point de prédiction sur la fenêtre.")).toBeDefined();
  });

  it("laisse un trou dans la courbe et compte les mesures absentes", async () => {
    fetchReadings.mockResolvedValue([
      makeReading({ timestamp: "2026-09-02T00:00:00Z", consumption_kw: 100 }),
      makeReading({
        timestamp: "2026-09-02T00:01:00Z",
        consumption_kw: null,
        consumption_kw_imputed: 99,
        data_quality: "degraded",
        imputation_method: "locf",
      }),
      makeReading({ timestamp: "2026-09-02T00:02:00Z", consumption_kw: 102 }),
    ]);

    render(<SiteDashboardPage />);

    expect(
      await screen.findByText(/1 mesure\(s\) absente\(s\) de la source/),
    ).toBeDefined();
  });
});
