import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "./AppRoutes";
import { DASHBOARD_PATH, LOGIN_PATH } from "./paths";
import { AuthProvider } from "../auth/AuthProvider";
import { closeSession } from "../auth/session";

const requestToken = vi.hoisted(() => vi.fn());
vi.mock("../api/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/auth")>()),
  requestToken,
}));

const fetchSites = vi.hoisted(() => vi.fn());
vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  fetchSites,
}));

function toBase64Url(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const TOKEN = `${toBase64Url({ alg: "HS256" })}.${toBase64Url({
  sub: "dev.reader",
  role: "reader",
  exp: Date.now() / 1000 + 3600,
})}.signature`;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

async function signIn() {
  const { fireEvent } = await import("@testing-library/react");
  fireEvent.change(screen.getByLabelText("Identifiant"), {
    target: { value: "dev.reader" },
  });
  fireEvent.change(screen.getByLabelText("Mot de passe"), {
    target: { value: "s3cret" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
  });
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.stubEnv("VITE_PREDICT_BASE_URL", "http://predict.test");
  requestToken.mockResolvedValue({
    access_token: TOKEN,
    token_type: "bearer",
    expires_in: 3600,
  });
  fetchSites.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  requestToken.mockReset();
  fetchSites.mockReset();
  closeSession();
});

describe("AppRoutes", () => {
  it("renvoie un visiteur anonyme du dashboard vers la connexion", async () => {
    renderAt(DASHBOARD_PATH);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Se connecter" })).toBeDefined();
    });
  });

  it("affiche le dashboard une fois la session ouverte", async () => {
    renderAt(LOGIN_PATH);

    await signIn();

    await waitFor(() => {
      expect(screen.getByLabelText("Site")).toBeDefined();
    });
  });

  it("ramène à la connexion dès que la session est fermée", async () => {
    renderAt(LOGIN_PATH);
    await signIn();
    await waitFor(() => {
      expect(screen.getByLabelText("Site")).toBeDefined();
    });

    await act(async () => {
      closeSession();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Se connecter" })).toBeDefined();
    });
  });

  it("revient sur l'adresse demandée avant le renvoi vers la connexion", async () => {
    renderAt("/une-page-inconnue");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Se connecter" })).toBeDefined();
    });
    await signIn();

    await waitFor(() => {
      expect(screen.getByLabelText("Site")).toBeDefined();
    });
  });

  it("n'affiche pas le formulaire à un utilisateur déjà connecté", async () => {
    renderAt(LOGIN_PATH);
    await signIn();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Se connecter" })).toBeNull();
    });
  });
});
