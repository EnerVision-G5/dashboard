import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SiteDashboardPage } from "./SiteDashboardPage";
import { ApiError } from "../api/http";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import {
  makeModel,
  makePrediction,
  makePredictionPoint,
  makeReading,
  makeRecommendations,
  makeSpikeSimulation,
  makeSensorFailure,
  makeSensorHealth,
  makeSite,
  makeSiteIndicators,
} from "../test/doubles";

vi.mock("recharts", async (importOriginal) => {
  const { withFixedSizeContainer } = await import("../test/rechartsMock");
  return withFixedSizeContainer(await importOriginal());
});

const fetchSites = vi.hoisted(() => vi.fn());
const fetchReadings = vi.hoisted(() => vi.fn());
const fetchLatestReading = vi.hoisted(() => vi.fn());
const fetchPredictions = vi.hoisted(() => vi.fn());
const fetchIndicators = vi.hoisted(() => vi.fn());
const fetchSensors = vi.hoisted(() => vi.fn());
const fetchSiteIndicators = vi.hoisted(() => vi.fn());
const fetchSensorHistory = vi.hoisted(() => vi.fn());
const fetchRecommendations = vi.hoisted(() => vi.fn());
const fetchSpikes = vi.hoisted(() => vi.fn());
const triggerSpike = vi.hoisted(() => vi.fn());
const fetchModels = vi.hoisted(() => vi.fn());
const fetchCurrentModel = vi.hoisted(() => vi.fn());
const syncSites = vi.hoisted(() => vi.fn());

vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  fetchSites,
  syncSites,
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
// Le bandeau d'EV-18 interroge l'API dès que la page est montée : sans ces
// deux doubles, chaque test attendrait un appel réseau réel et le bandeau
// afficherait une erreur, au risque de deux « alert » là où les tests d'erreur
// n'en attendent qu'un.
vi.mock("../api/indicators", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/indicators")>()),
  fetchIndicators,
  fetchSiteIndicators,
}));
vi.mock("../api/sensors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sensors")>()),
  fetchSensors,
  fetchSensorHistory,
}));
vi.mock("../api/recommendations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/recommendations")>()),
  fetchRecommendations,
}));
vi.mock("../api/simulations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/simulations")>()),
  fetchSpikes,
  triggerSpike,
}));
vi.mock("../api/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/models")>()),
  fetchModels,
  fetchCurrentModel,
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
function renderPage({ role = "reader" as "reader" | "writer" } = {}) {
  const signOut = vi.fn();
  const value: AuthContextValue = {
    // Le rôle décide de l'affichage des commandes : les deux routes qu'elles
    // appellent sont réservées au writer par le contrat.
    session: { ...SESSION, claims: { ...SESSION.claims, role } },
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
  fetchIndicators.mockResolvedValue([
    makeSiteIndicators({ site_id: "SITE-001" }),
    makeSiteIndicators({ site_id: "SITE-002" }),
  ]);
  fetchSensors.mockResolvedValue([makeSensorHealth()]);
  fetchSiteIndicators.mockResolvedValue(makeSiteIndicators({ site_id: "SITE-001" }));
  fetchSensorHistory.mockResolvedValue([]);
  fetchRecommendations.mockResolvedValue(makeRecommendations({ site_id: "SITE-001" }));
  fetchSpikes.mockResolvedValue([]);
  fetchModels.mockResolvedValue([makeModel()]);
  fetchCurrentModel.mockResolvedValue(makeModel());
  triggerSpike.mockResolvedValue(makeSpikeSimulation());
  syncSites.mockResolvedValue({ received: 7, synchronized: 7, sites: [] });
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
      // Depuis EV-52, plusieurs zones de l'écran annoncent leur propre
      // chargement — chacune la sienne, ce qui est le comportement voulu. On
      // cherche donc celle qui parle du site, pas l'unique.
      const chargements = screen.getAllByRole("status").map((zone) => zone.textContent);
      expect(chargements.some((texte) => texte?.includes("Entrepôt Rezé"))).toBe(true);
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

describe("SiteDashboardPage · bandeau de fraîcheur et de qualité (EV-18)", () => {
  it("qualifie les données du parc au-dessus des panneaux", async () => {
    renderPage();

    // La région porte le même nom pendant la vérification et après : on
    // attend donc son verdict, pas son apparition.
    expect(await screen.findByText(/Données à jour/)).toBeDefined();
    const banner = screen.getByRole("region", {
      name: "Fraîcheur et qualité des données",
    });
    expect(banner.textContent).toContain("2 site(s) examiné(s)");
    expect(fetchIndicators).toHaveBeenCalled();
    expect(fetchSensors).toHaveBeenCalledWith(
      expect.anything(),
      "SITE-001",
      expect.anything(),
    );
  });

  it("alerte sur un site muet sans effacer les mesures du site affiché", async () => {
    fetchIndicators.mockResolvedValue([
      makeSiteIndicators({ site_id: "SITE-001" }),
      makeSiteIndicators({
        site_id: "SITE-002",
        ingestion: {
          last_measure_at: null,
          last_ingested_at: null,
          measure_age_seconds: null,
          ingestion_lag_seconds: null,
          is_stale: true,
          stale_threshold_seconds: 300,
          collector: null,
        },
      }),
    ]);

    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Données inexploitables sur au moins un site");
    // Le site est nommé par son libellé, pas par son identifiant technique.
    expect(screen.getByText(/Entrepôt Rezé n'a aucune mesure/)).toBeDefined();
    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
  });

  it("suit le site choisi pour l'état des capteurs", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    await waitFor(() => {
      expect(fetchSensors).toHaveBeenLastCalledWith(
        expect.anything(),
        "SITE-002",
        expect.anything(),
      );
    });
  });
});

describe("SiteDashboardPage · diagnostics du site (EV-52)", () => {
  it("affiche les trois panneaux de diagnostic sous la maquette", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ingestion des mesures", level: 2 }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Écart prédiction / réel", level: 2 }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", {
        name: "Mesures écartées et pannes de capteur",
        level: 2,
      }),
    ).toBeDefined();
  });

  it("passe au panneau temps réel le seuil de retard de l'API", async () => {
    // Mesure vieille de trois minutes, seuil de l'API à cinq : le panneau ne
    // doit pas annoncer de retard, alors que son seuil interne de deux minutes
    // l'aurait fait.
    fetchLatestReading.mockResolvedValue(
      makeReading({ site_id: "SITE-001", timestamp: new Date(Date.now() - 180_000).toISOString() }),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Ingestion des mesures", level: 2 });
    expect(screen.queryByText(/l'ingestion est en retard/)).toBeNull();
  });

  it("résume les mesures écartées de la fenêtre affichée", async () => {
    fetchReadings.mockResolvedValue([
      makeReading({ site_id: "SITE-001", timestamp: "2026-09-02T00:00:00Z" }),
      makeReading({
        site_id: "SITE-001",
        timestamp: "2026-09-02T00:01:00Z",
        excluded: true,
        exclusion_reason: "temperature_sensor_failure",
      }),
    ]);

    renderPage();

    expect(await screen.findByText("1")).toBeDefined();
    expect(screen.getByText("1 × temperature_sensor_failure")).toBeDefined();
  });

  it("affiche l'historique des pannes du site affiché", async () => {
    fetchSensorHistory.mockResolvedValue([
      makeSensorFailure({ capteur: "network", ended_at: null, ongoing: true }),
    ]);

    renderPage();

    expect(await screen.findByText("Capteur réseau")).toBeDefined();
    expect(screen.getByText(/panne en cours/)).toBeDefined();
  });

  it("suit le site choisi pour ses diagnostics", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Ingestion des mesures", level: 2 });

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    await waitFor(() => {
      expect(fetchSiteIndicators).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: "SITE-002" }),
      );
    });
    expect(fetchSensorHistory).toHaveBeenLastCalledWith(
      expect.anything(),
      "SITE-002",
      expect.anything(),
    );
  });

  it("garde les mesures affichées quand les diagnostics échouent", async () => {
    fetchSiteIndicators.mockRejectedValue(
      new ApiError("L'API métier est injoignable.", null),
    );

    renderPage();

    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((alert) => alert.textContent?.includes("État de l'ingestion indisponible")),
    ).toBe(true);
  });
});

describe("SiteDashboardPage · recommandations (EV-54)", () => {
  it("remplit la zone Recommandations avec les actions de l'API", async () => {
    renderPage();

    expect(
      await screen.findByText("Pointe prévue à 18 h : décaler la charge du four si possible."),
    ).toBeDefined();
    expect(screen.getByText("élevée")).toBeDefined();
    expect(fetchRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("suit le site choisi", async () => {
    renderPage();
    await screen.findByText("Pointe prévue à 18 h : décaler la charge du four si possible.");

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE-002" } });

    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenLastCalledWith(
        expect.objectContaining({ siteId: "SITE-002" }),
      );
    });
  });

  it("garde les mesures affichées quand seules les recommandations échouent", async () => {
    fetchRecommendations.mockRejectedValue(
      new ApiError("L'API métier est injoignable.", null),
    );

    renderPage();

    expect(await screen.findByText("Consommation réelle (kW)")).toBeDefined();
    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((alert) => alert.textContent?.includes("Recommandations indisponibles")),
    ).toBe(true);
  });

  it("reprend la raison de l'API quand aucune action n'est à proposer", async () => {
    fetchRecommendations.mockResolvedValue(
      makeRecommendations({
        items: [],
        detail: "Aucune prévision archivée sur l'horizon demandé.",
        model_version: null,
      }),
    );

    renderPage();

    expect(
      await screen.findByText("Aucune prévision archivée sur l'horizon demandé."),
    ).toBeDefined();
  });
});

describe("SiteDashboardPage · commandes et historiques", () => {
  it("affiche l'historique des pics et le registre des modèles", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Historique des pics de charge", level: 2 }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Modèles", level: 2 })).toBeDefined();
    expect(await screen.findByText("enervision_xgboost · 3")).toBeDefined();
  });

  it("ne propose aucune commande à un rôle lecteur", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Actions d'exploitation", level: 2 });
    expect(screen.queryByRole("button", { name: /Déclencher un pic/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recharger les sites" })).toBeNull();
    expect(
      screen.getByText("Le rôle reader ne permet pas d'agir sur la source."),
    ).toBeDefined();
  });

  it("relit l'historique des pics après un déclenchement", async () => {
    renderPage({ role: "writer" });
    await screen.findByRole("button", { name: /Déclencher un pic/ });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Déclencher un pic/ }));
    });

    expect(triggerSpike).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
    // Deux lectures : le montage, puis celle que le déclenchement provoque.
    await waitFor(() => {
      expect(fetchSpikes).toHaveBeenCalledTimes(2);
    });
  });

  it("relit le référentiel après une synchronisation", async () => {
    renderPage({ role: "writer" });
    await screen.findByRole("button", { name: "Recharger les sites" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Recharger les sites" }));
    });

    expect(syncSites).toHaveBeenCalled();
    await waitFor(() => {
      expect(fetchSites).toHaveBeenCalledTimes(2);
    });
    expect(
      screen.getByText("7 site(s) synchronisé(s) sur 7 annoncé(s) par la source"),
    ).toBeDefined();
  });

  it("nomme le refus quand la source rejette le pic", async () => {
    triggerSpike.mockRejectedValue(
      new ApiError("L'API métier a renvoyé une erreur serveur (502).", 502),
    );

    renderPage({ role: "writer" });
    await screen.findByRole("button", { name: /Déclencher un pic/ });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Déclencher un pic/ }));
    });

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((alert) => alert.textContent?.includes("Commande refusée")),
    ).toBe(true);
  });
});

describe("SiteDashboardPage · période de l'historique (EV-53)", () => {
  it("interroge les 24 dernières heures à l'ouverture", async () => {
    renderPage();

    await screen.findByText("Consommation réelle (kW)");
    const { startTime, endTime } = fetchReadings.mock.calls[0][0];
    const heures = (Date.parse(endTime) - Date.parse(startTime)) / 3_600_000;
    expect(Math.round(heures)).toBe(24);
  });

  it("relit les mesures sur la durée rapide choisie", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "6 h" }));
    });

    await waitFor(() => {
      const dernier = fetchReadings.mock.calls.at(-1)?.[0];
      const heures =
        (Date.parse(dernier.endTime) - Date.parse(dernier.startTime)) / 3_600_000;
      expect(Math.round(heures)).toBe(6);
    });
  });

  it("relit les mesures sur les bornes saisies", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");

    const debut = new Date("2026-09-01T08:00:00Z");
    const fin = new Date("2026-09-01T20:00:00Z");
    const local = (moment: Date) =>
      new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);

    fireEvent.change(screen.getByLabelText("Début"), { target: { value: local(debut) } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: local(fin) } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    });

    await waitFor(() => {
      expect(fetchReadings).toHaveBeenLastCalledWith(
        expect.objectContaining({
          startTime: debut.toISOString(),
          endTime: fin.toISOString(),
        }),
      );
    });
  });

  it("ne prolonge pas la fenêtre des prédictions sur une période passée", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");

    const debut = new Date("2026-09-01T08:00:00Z");
    const fin = new Date("2026-09-01T20:00:00Z");
    const local = (moment: Date) =>
      new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);

    fireEvent.change(screen.getByLabelText("Début"), { target: { value: local(debut) } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: local(fin) } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    });

    // Période entièrement passée : les prédictions utiles sont celles
    // archivées pendant cette période, pas les 24 h qui la suivent.
    await waitFor(() => {
      expect(fetchPredictions).toHaveBeenLastCalledWith(
        expect.objectContaining({ endTime: fin.toISOString() }),
      );
    });
  });

  it("refuse une période inversée sans appeler l'API", async () => {
    renderPage();
    await screen.findByText("Consommation réelle (kW)");
    const avant = fetchReadings.mock.calls.length;

    const local = (iso: string) => {
      const moment = new Date(iso);
      return new Date(moment.getTime() - moment.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
    };
    fireEvent.change(screen.getByLabelText("Début"), {
      target: { value: local("2026-09-02T20:00:00Z") },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: local("2026-09-02T08:00:00Z") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((zone) =>
        zone.textContent?.includes("La date de fin doit suivre la date de début."),
      ),
    ).toBe(true);
    expect(fetchReadings.mock.calls.length).toBe(avant);
  });
});
