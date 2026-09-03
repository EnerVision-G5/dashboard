import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginPage, REQUIRED_FIELD_MESSAGE } from "./LoginPage";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";

/** Contexte d'authentification factice : l'écran n'appelle jamais le réseau. */
function renderLogin(overrides: Partial<AuthContextValue> = {}) {
  const signIn = overrides.signIn ?? vi.fn().mockResolvedValue(true);
  const value: AuthContextValue = {
    session: null,
    isAuthenticated: false,
    isSigningIn: false,
    error: null,
    signOut: vi.fn(),
    ...overrides,
    signIn,
  };
  render(
    <AuthContext value={value}>
      <LoginPage />
    </AuthContext>,
  );
  return { signIn };
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("LoginPage", () => {
  it("expose deux champs étiquetés et un bouton de soumission", () => {
    renderLogin();

    expect(screen.getByLabelText("Identifiant")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText("Mot de passe")).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeDefined();
  });

  it("masque la saisie du mot de passe", () => {
    renderLogin();

    expect(screen.getByLabelText("Mot de passe").getAttribute("type")).toBe("password");
  });

  it("refuse une soumission aux champs vides sans appeler l'API", () => {
    const { signIn } = renderLogin();

    submit();

    expect(screen.getAllByText(REQUIRED_FIELD_MESSAGE)).toHaveLength(2);
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signale le seul champ manquant quand l'autre est renseigné", () => {
    const { signIn } = renderLogin();

    fill("Identifiant", "dev.reader");
    submit();

    expect(screen.getAllByText(REQUIRED_FIELD_MESSAGE)).toHaveLength(1);
    expect(screen.getByLabelText("Mot de passe").getAttribute("aria-invalid")).toBe("true");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("tient un identifiant fait d'espaces pour absent", () => {
    const { signIn } = renderLogin();

    fill("Identifiant", "   ");
    fill("Mot de passe", "s3cret");
    submit();

    expect(signIn).not.toHaveBeenCalled();
  });

  it("transmet les identifiants saisis quand le formulaire est complet", async () => {
    const { signIn } = renderLogin();

    fill("Identifiant", "dev.reader");
    fill("Mot de passe", "s3cret");
    submit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("dev.reader", "s3cret");
    });
  });

  it("efface le mot de passe une fois la connexion aboutie", async () => {
    renderLogin();

    fill("Identifiant", "dev.reader");
    fill("Mot de passe", "s3cret");
    submit();

    await waitFor(() => {
      expect((screen.getByLabelText("Mot de passe") as HTMLInputElement).value).toBe("");
    });
  });

  it("conserve la saisie quand la connexion échoue, pour ne pas tout retaper", async () => {
    const signIn = vi.fn().mockResolvedValue(false);
    renderLogin({ signIn });

    fill("Identifiant", "dev.reader");
    fill("Mot de passe", "faux");
    submit();

    await waitFor(() => {
      expect(signIn).toHaveBeenCalled();
    });
    expect((screen.getByLabelText("Mot de passe") as HTMLInputElement).value).toBe("faux");
  });

  it("affiche l'erreur d'authentification en région d'alerte", () => {
    renderLogin({ error: "Identifiants invalides." });

    expect(screen.getByRole("alert").textContent).toBe("Identifiants invalides.");
  });

  it("annonce le chargement et verrouille le bouton pendant l'appel", () => {
    renderLogin({ isSigningIn: true });

    const button = screen.getByRole("button", { name: "Connexion en cours…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
