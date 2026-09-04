import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SiteActionsPanel } from "./SiteActionsPanel";
import { ApiError } from "../api/http";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import { makeSpikeSimulation } from "../test/doubles";

const triggerSpike = vi.hoisted(() => vi.fn());
const syncSites = vi.hoisted(() => vi.fn());

vi.mock("../api/simulations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/simulations")>()),
  triggerSpike,
}));
vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  syncSites,
}));

function renderPanel({
  role = "writer" as "reader" | "writer" | null,
  ...props
}: {
  role?: "reader" | "writer" | null;
  onSpikeTriggered?: () => void;
  onSitesSynced?: () => void;
} = {}) {
  const value: AuthContextValue = {
    session:
      role === null
        ? null
        : {
            token: "entete.charge.signature",
            claims: { username: "dev", role, expiresAtMs: null },
          },
    isAuthenticated: role !== null,
    isSigningIn: false,
    error: null,
    signIn: vi.fn().mockResolvedValue(true),
    signOut: vi.fn(),
  };
  render(
    <AuthContext value={value}>
      <SiteActionsPanel siteId="SITE-001" siteName="Usine Nantes Nord" {...props} />
    </AuthContext>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  triggerSpike.mockResolvedValue(makeSpikeSimulation());
  syncSites.mockResolvedValue({ received: 7, synchronized: 7, sites: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  triggerSpike.mockReset();
  syncSites.mockReset();
});

describe("SiteActionsPanel · garde de rôle", () => {
  it("ne propose rien à un lecteur, et dit pourquoi", () => {
    renderPanel({ role: "reader" });

    expect(screen.queryByRole("button")).toBeNull();
    expect(
      screen.getByText("Le rôle reader ne permet pas d'agir sur la source."),
    ).toBeDefined();
    expect(screen.getByText(/réserve le déclenchement d'un pic/)).toBeDefined();
  });

  it("ne propose rien hors session", () => {
    renderPanel({ role: null });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Aucune session ouverte.")).toBeDefined();
  });

  it("propose les deux commandes à un writer", () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Déclencher un pic de 30 min" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Recharger les sites" })).toBeDefined();
  });
});

describe("SiteActionsPanel · déclenchement d'un pic", () => {
  it("déclenche le pic et rend compte de ce que la source a fait", async () => {
    const onSpikeTriggered = vi.fn();
    renderPanel({ onSpikeTriggered });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Déclencher un pic de 30 min" }));
    });

    expect(triggerSpike).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Pic de 30 min demandé sur Usine Nantes Nord");
    expect(status.textContent).toContain("812 kW relevés");
    // Le pic est réel : il n'apparaîtra qu'au relevé suivant, et le dire évite
    // qu'on cherche en vain la pointe sur le graphique.
    expect(status.textContent).toContain("au relevé suivant");
    expect(onSpikeTriggered).toHaveBeenCalled();
  });

  it("n'annonce aucun relevé quand la source n'en renvoie pas", async () => {
    triggerSpike.mockResolvedValue(
      makeSpikeSimulation({ consumption_kw_constatee: null, data_quality_constatee: null }),
    );
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Déclencher un pic de 30 min" }));
    });

    expect(screen.getByRole("status").textContent).not.toContain("kW relevés");
  });

  it("nomme un refus de rôle sans prévenir l'appelant du succès", async () => {
    const onSpikeTriggered = vi.fn();
    triggerSpike.mockRejectedValue(
      new ApiError("Rôle insuffisant pour cette opération (403).", 403),
    );
    renderPanel({ onSpikeTriggered });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Déclencher un pic de 30 min" }));
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Commande refusée");
    expect(alert.textContent).toContain("403");
    expect(onSpikeTriggered).not.toHaveBeenCalled();
  });
});

describe("SiteActionsPanel · synchronisation du référentiel", () => {
  it("synchronise et prévient l'écran de relire le référentiel", async () => {
    const onSitesSynced = vi.fn();
    renderPanel({ onSitesSynced });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Recharger les sites" }));
    });

    expect(syncSites).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe(
      "7 site(s) synchronisé(s) sur 7 annoncé(s) par la source",
    );
    expect(onSitesSynced).toHaveBeenCalled();
  });

  it("signale les sites écartés par l'API plutôt que de les taire", async () => {
    syncSites.mockResolvedValue({ received: 7, synchronized: 5, sites: [] });
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Recharger les sites" }));
    });

    expect(screen.getByRole("status").textContent).toContain(
      "2 écarté(s), champs obligatoires manquants",
    );
  });

  it("nomme une source injoignable", async () => {
    syncSites.mockRejectedValue(
      new ApiError("L'API métier a renvoyé une erreur serveur (502).", 502),
    );
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Recharger les sites" }));
    });

    expect(screen.getByRole("alert").textContent).toContain("502");
  });
});
