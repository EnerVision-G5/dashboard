import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SiteDiagnosticPage } from "./SiteDiagnosticPage";
import { ApiError } from "../api/http";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import {
  makeModel,
  makePrediction,
  makeReading,
  makeSensorFailure,
  makeSite,
  makeSiteIndicators,
  makeSpikeSimulation,
} from "../test/doubles";

const fetchSites = vi.hoisted(() => vi.fn());
const fetchReadings = vi.hoisted(() => vi.fn());
const fetchPredictions = vi.hoisted(() => vi.fn());
const fetchSiteIndicators = vi.hoisted(() => vi.fn());
const fetchSensorHistory = vi.hoisted(() => vi.fn());
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
}));
vi.mock("../api/predictions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/predictions")>()),
  fetchPredictions,
}));
vi.mock("../api/indicators", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/indicators")>()),
  fetchSiteIndicators,
}));
vi.mock("../api/sensors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sensors")>()),
  fetchSensorHistory,
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
const SITE_B = makeSite({ site_id: "SITE-002", site_name: "Entrepôt Rezé", status: "active" });

const SESSION = {
  token: "entete.charge.signature",
  claims: { username: "dev.reader", role: "reader" as const, expiresAtMs: null },
};

/** Monte l'écran de diagnostic dans une session déjà ouverte. */
function renderPage({ role = "reader" as "reader" | "writer" } = {}) {
  const value: AuthContextValue = {
    session: { ...SESSION, claims: { ...SESSION.claims, role } },
    isAuthenticated: true,
    isSigningIn: false,
    error: null,
    signIn: vi.fn().mockResolvedValue(true),
    signOut: vi.fn(),
  };
  render(
    <MemoryRouter>
      <AuthContext value={value}>
        <SiteDiagnosticPage />
      </AuthContext>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  fetchSites.mockResolvedValue([SITE_A, SITE_B]);
  fetchReadings.mockResolvedValue([makeReading({ site_id: "SITE-001" })]);
  fetchPredictions.mockResolvedValue(makePrediction({ points: [] }));
  fetchSiteIndicators.mockResolvedValue(makeSiteIndicators({ site_id: "SITE-001" }));
  fetchSensorHistory.mockResolvedValue([]);
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
describe("SiteDiagnosticPage · état de la donnée", () => {
  it("affiche les trois panneaux de diagnostic côte à côte", async () => {
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

    // Le graphique de qualité d'EV-19 affiche aussi des chiffres seuls : on
    // compte le total dans le panneau qui en parle.
    expect(
      await screen.findByText("1 × temperature_sensor_failure"),
    ).toBeDefined();
    const panneau = screen.getByRole("region", {
      name: "Mesures écartées et pannes de capteur",
    });
    expect(within(panneau).getByText("1")).toBeDefined();
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

    // Les panneaux échouent indépendamment : celui des mesures écartées ne
    // dépend pas des indicateurs et reste affiché.
    expect(
      await screen.findByRole("heading", {
        name: "Mesures écartées et pannes de capteur",
        level: 2,
      }),
    ).toBeDefined();
    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((alert) => alert.textContent?.includes("État de l'ingestion indisponible")),
    ).toBe(true);
  });
});

describe("SiteDiagnosticPage · commandes et historiques", () => {
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
