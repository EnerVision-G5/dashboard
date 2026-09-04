import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SiteDashboardPage } from "./SiteDashboardPage";
import { ApiError } from "../api/http";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
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
const fetchLatestReading = vi.hoisted(() => vi.fn());
const fetchPredictions = vi.hoisted(() => vi.fn());

vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  fetchSites,
}));
vi.mock("../api/readings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/readings")>()),
  fetchReadings,
  fetchLatestReading,
}));
vi.mock("../api/predictions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/predictions")>()),
  fetchPredictions,
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

const SESSION = {
  token: "entete.charge.signature",
  claims: { username: "dev.reader", role: "reader" as const, expiresAtMs: null },
};

/**
 * Monte l'écran dans un contexte d'authentification déjà ouvert : ces tests
 * portent sur la supervision, la connexion est couverte par AppRoutes.
 */
function renderPage() {
  const signOut = vi.fn();
  const value: AuthContextValue = {
    session: SESSION,
    isAuthenticated: true,
    isSigningIn: false,
    error: null,
    signIn: vi.fn().mockResolvedValue(true),
    signOut,
  };
  render(
    <AuthContext value={value}>
      <SiteDashboardPage />
    </AuthContext>,
  );
  return { signOut };
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubEnv("VITE_PREDICT_BASE_URL", "http://predict.test");
  fetchSites.mockResolvedValue([SITE_A, SITE_B]);
  fetchReadings.mockResolvedValue(readingsOf("SITE-001", 100));
  fetchLatestReading.mockResolvedValue(
    makeReading({ site_id: "SITE-001", consumption_kw: 2654 }),
  );
  fetchPredictions.mockResolvedValue(
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
    renderPage();

    expect((screen.getByLabelText("Site") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole("option", { name: "Chargement des sites…" })).toBeDefined();
  });

  it("sélectionne le premier site actif et trace les deux séries", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Usine Nantes Nord", level: 2 });
    expect((screen.getByLabelText("Site") as HTMLSelectElement).value).toBe("SITE-001");
    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    expect(screen.getByText("Prédiction (kW)")).toBeDefined();
    expect(fetchReadings).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
    expect(fetchPredictions).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("recharge les deux flux au changement de site sans réutiliser les données du précédent", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");

    let resolveReadings: (value: unknown) => void = () => {};
    fetchReadings.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveReadings = resolve;
        }),
    );
    fetchPredictions.mockResolvedValue(makePrediction({ siteId: "SITE-002", points: [] }));

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
    fetchPredictions.mockResolvedValue(makePrediction({ points: [] }));

    renderPage();

    expect(
      await screen.findByText(/Aucune donnée à afficher pour ce site/),
    ).toBeDefined();
  });

  it("signale un référentiel de sites vide", async () => {
    fetchSites.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText("Aucun site n'est encore supervisé par l'API métier."),
    ).toBeDefined();
  });

  it("affiche l'erreur de l'API métier sans remplacer les mesures", async () => {
    fetchReadings.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Mesures indisponibles");
    expect(alert.textContent).toContain("L'API métier est injoignable.");
  });

  it("garde les mesures affichées quand seule la prédiction échoue", async () => {
    fetchPredictions.mockRejectedValue(
      new ApiError("Le service d'inférence n'implémente pas encore cet endpoint (501).", 501),
    );

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Prédiction indisponible");
    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    expect(screen.getByText("Aucun point de prédiction sur la fenêtre.")).toBeDefined();
  });

  it("n'appelle pas le service d'inférence et affiche le bandeau en mode fixture", async () => {
    vi.stubEnv("VITE_PREDICTION_SOURCE", "fixture");

    renderPage();

    const badge = await screen.findByText("Données de démonstration");
    expect(badge).toBeDefined();
    expect(
      screen.getByText(/La courbe de prédiction provient d'un JSON figé/),
    ).toBeDefined();
    expect(await screen.findByText("Prédiction (kW)")).toBeDefined();
    expect(fetchPredictions).not.toHaveBeenCalled();
  });

  it("ne bascule jamais sur le JSON de démonstration quand l'appel réel échoue", async () => {
    fetchPredictions.mockRejectedValue(
      new ApiError("Le service d'inférence n'implémente pas encore cet endpoint (501).", 501),
    );

    renderPage();

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

    renderPage();

    expect(
      await screen.findByText(/1 mesure\(s\) absente\(s\) de la source/),
    ).toBeDefined();
  });
});

/**
 * Depuis EV-50, l'identité du produit, l'utilisateur connecté et la
 * déconnexion sont portés par la navigation principale : ces trois
 * comportements sont vérifiés dans `AppNavbar.test.tsx`, et cette suite ne
 * couvre plus que ce que la page rend elle-même.
 */
describe("SiteDashboardPage · mise en page de la maquette", () => {
  it("affiche les trois zones de la maquette une fois un site choisi", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Consommation temps réel", level: 2 }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Recommandations", level: 2 })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Indicateurs", level: 2 })).toBeDefined();
  });

  it("affiche la puissance souscrite et la localisation du site choisi", async () => {
    renderPage();

    expect(await screen.findByText("Puissance souscrite 500 kW")).toBeDefined();
    expect(screen.getByText(/Nantes · usine · active/)).toBeDefined();
  });

  it("suit le site choisi dans l'en-tête", async () => {
    fetchLatestReading.mockResolvedValue(makeReading({ site_id: "SITE-002" }));
    renderPage();
    await screen.findByText(/Nantes · usine · active/);

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    expect(await screen.findByText(/Rezé · usine · active/)).toBeDefined();
  });

  it("alimente le panneau temps réel avec la dernière mesure du site", async () => {
    fetchLatestReading.mockResolvedValue(
      makeReading({
        site_id: "SITE-001",
        consumption_kw: 2654,
        voltage_v: 401.2,
        current_a: 132.5,
      }),
    );

    renderPage();

    expect(await screen.findByText("2 654 kW")).toBeDefined();
    expect(screen.getByText("401,2 V")).toBeDefined();
    expect(screen.getByText("132,5 A")).toBeDefined();
    expect(fetchLatestReading).toHaveBeenCalledWith(
      expect.anything(),
      "SITE-001",
      expect.anything(),
    );
  });

  it("garde le graphique quand seule la dernière mesure échoue", async () => {
    fetchLatestReading.mockRejectedValue(new ApiError("Site introuvable.", 404));

    renderPage();

    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((alert) => alert.textContent?.includes("Site introuvable."))).toBe(true);
  });

  it("ne porte plus l'en-tête du produit, désormais dans la navigation", () => {
    renderPage();

    expect(screen.queryByRole("heading", { name: "Smart Energy Optimiser" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Se déconnecter" })).toBeNull();
  });
});
