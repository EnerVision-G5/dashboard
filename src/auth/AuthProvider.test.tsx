import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, EXPIRY_MARGIN_MS } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { closeSession } from "./session";
import { ApiError } from "../api/http";

const requestToken = vi.hoisted(() => vi.fn());
vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  requestToken,
}));

function toBase64Url(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const NOW = new Date("2026-09-03T10:00:00Z");
const ONE_HOUR_MS = 3_600_000;

function makeToken(expiresInMs: number | null): string {
  return `${toBase64Url({ alg: "HS256" })}.${toBase64Url({
    sub: "dev.reader",
    role: "reader",
    ...(expiresInMs === null ? {} : { exp: (NOW.getTime() + expiresInMs) / 1000 }),
  })}.signature`;
}

function respondWith(token: string) {
  requestToken.mockResolvedValue({
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
  });
}

function Probe() {
  const { isAuthenticated, isSigningIn, error, session, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="state">
        {isSigningIn ? "connexion" : isAuthenticated ? "connecté" : "anonyme"}
      </span>
      <span data-testid="user">{session?.claims.username ?? "aucun"}</span>
      <span data-testid="error">{error ?? "aucune"}</span>
      <button type="button" onClick={() => void signIn("dev.reader", "s3cret")}>
        connexion
      </button>
      <button type="button" onClick={signOut}>
        déconnexion
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  // shouldAdvanceTime : nécessaire pour que le rendu déclenché par un clic
  // (Testing Library planifie sa propre reconciliation via un timer interne)
  // progresse sans qu'il faille avancer l'horloge à la main après chaque
  // interaction. La contrepartie, gérée dans le test de marge ci-dessous, est
  // que l'horloge dérive aussi du temps réel écoulé entre deux appels : les
  // avances manuelles ne doivent donc jamais viser une fenêtre de quelques
  // millisecondes, qu'un runner chargé peut dépasser à elles seules.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  requestToken.mockReset();
  closeSession();
});

describe("AuthProvider", () => {
  it("démarre anonyme, aucun jeton n'étant conservé entre deux chargements", () => {
    renderProbe();

    expect(screen.getByTestId("state").textContent).toBe("anonyme");
  });

  it("ouvre une session et expose l'utilisateur du jeton", async () => {
    respondWith(makeToken(ONE_HOUR_MS));
    renderProbe();

    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    expect(screen.getByTestId("state").textContent).toBe("connecté");
    expect(screen.getByTestId("user").textContent).toBe("dev.reader");
  });

  it("transmet les identifiants saisis au flux OAuth2", async () => {
    respondWith(makeToken(ONE_HOUR_MS));
    renderProbe();

    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    expect(requestToken).toHaveBeenCalledWith(
      expect.objectContaining({ username: "dev.reader", password: "s3cret" }),
    );
  });

  it("expose le message de refus et reste anonyme", async () => {
    requestToken.mockRejectedValue(new ApiError("Identifiants invalides.", 401));
    renderProbe();

    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    expect(screen.getByTestId("state").textContent).toBe("anonyme");
    expect(screen.getByTestId("error").textContent).toBe("Identifiants invalides.");
  });

  it("refuse un jeton illisible plutôt que d'ouvrir une session inutilisable", async () => {
    respondWith("pas-un-jeton");
    renderProbe();

    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    expect(screen.getByTestId("state").textContent).toBe("anonyme");
    expect(screen.getByTestId("error").textContent).toContain("illisible");
  });

  it("efface le message de refus quand une nouvelle tentative aboutit", async () => {
    requestToken.mockRejectedValueOnce(new ApiError("Identifiants invalides.", 401));
    renderProbe();
    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    respondWith(makeToken(ONE_HOUR_MS));
    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    expect(screen.getByTestId("error").textContent).toBe("aucune");
  });

  it("ferme la session sur demande", async () => {
    respondWith(makeToken(ONE_HOUR_MS));
    renderProbe();
    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    await act(async () => {
      screen.getByRole("button", { name: "déconnexion" }).click();
    });

    expect(screen.getByTestId("state").textContent).toBe("anonyme");
  });

  it("ferme la session à l'échéance du jeton, marge comprise", async () => {
    // La fenêtre de chaque côté du seuil est en secondes, pas en
    // millisecondes : avec shouldAdvanceTime, l'horloge simulée dérive aussi
    // du temps réel écoulé entre deux appels, et une fenêtre de 1-2 ms serait
    // déjà franchie par cette seule dérive sur un runner chargé — c'est
    // exactement ce qui a rendu ce test intermittent en CI. Dix secondes de
    // marge absorbent une dérive bien supérieure à ce qu'un test unitaire
    // peut réellement accumuler.
    const SURETE_MS = 10_000;
    respondWith(makeToken(ONE_HOUR_MS));
    renderProbe();
    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });
    expect(screen.getByTestId("state").textContent).toBe("connecté");

    await act(async () => {
      vi.advanceTimersByTime(ONE_HOUR_MS - EXPIRY_MARGIN_MS - SURETE_MS);
    });
    expect(screen.getByTestId("state").textContent).toBe("connecté");

    await act(async () => {
      vi.advanceTimersByTime(2 * SURETE_MS);
    });
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("anonyme");
    });
  });

  it("garde ouverte une session dont le jeton ne porte pas d'échéance", async () => {
    respondWith(makeToken(null));
    renderProbe();
    await act(async () => {
      screen.getByRole("button", { name: "connexion" }).click();
    });

    await act(async () => {
      vi.advanceTimersByTime(ONE_HOUR_MS * 24);
    });

    expect(screen.getByTestId("state").textContent).toBe("connecté");
  });
});

describe("useAuth", () => {
  it("échoue bruyamment hors de son provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Probe />)).toThrow("useAuth doit être appelé dans un AuthProvider.");

    consoleError.mockRestore();
  });
});
