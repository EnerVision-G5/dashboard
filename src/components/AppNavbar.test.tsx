import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppNavbar } from "./AppNavbar";
import { AuthContext } from "../auth/AuthContext";
import type { AuthContextValue } from "../auth/AuthContext";
import { CONFIG_PATH, DASHBOARD_PATH, DIAGNOSTIC_PATH } from "../routes/paths";

const SESSION = {
  token: "entete.charge.signature",
  claims: { username: "dev.reader", role: "reader" as const, expiresAtMs: null },
};

/**
 * Monte la barre à une adresse donnée, dans une session déjà ouverte.
 *
 * Le `MemoryRouter` est indispensable : `NavLink` lit l'adresse courante pour
 * décider de l'état actif, et c'est précisément ce que ces tests vérifient.
 */
function renderNavbar(
  path: string = DASHBOARD_PATH,
  session: AuthContextValue["session"] = SESSION,
) {
  const signOut = vi.fn();
  const value: AuthContextValue = {
    session,
    isAuthenticated: session !== null,
    isSigningIn: false,
    error: null,
    signIn: vi.fn().mockResolvedValue(true),
    signOut,
  };
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext value={value}>
        <AppNavbar />
      </AuthContext>
    </MemoryRouter>,
  );
  return { signOut };
}

describe("AppNavbar", () => {
  it("porte le titre du produit", () => {
    renderNavbar();

    expect(
      screen.getByRole("heading", { name: "Smart Energy Optimiser", level: 1 }),
    ).toBeDefined();
  });

  it("donne accès au dashboard et à la configuration", () => {
    renderNavbar();

    const navigation = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(navigation).toBeDefined();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
      DASHBOARD_PATH,
    );
    expect(screen.getByRole("link", { name: "Configuration" }).getAttribute("href")).toBe(
      CONFIG_PATH,
    );
  });

  it("donne accès au diagnostic, séparé de la supervision", () => {
    renderNavbar();

    // Onze cartes sur une page ne se lisaient pas : le diagnostic a son écran.
    expect(screen.getByRole("link", { name: "Diagnostic" }).getAttribute("href")).toBe(
      DIAGNOSTIC_PATH,
    );
  });

  it("affiche l'utilisateur connecté et son rôle", () => {
    renderNavbar();

    expect(screen.getByText("dev.reader · reader")).toBeDefined();
  });

  it("ferme la session sur demande", () => {
    const { signOut } = renderNavbar();

    fireEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));

    expect(signOut).toHaveBeenCalled();
  });

  it("n'affiche ni utilisateur ni déconnexion hors session", () => {
    renderNavbar(DASHBOARD_PATH, null);

    expect(screen.queryByRole("button", { name: "Se déconnecter" })).toBeNull();
    expect(screen.queryByText("dev.reader · reader")).toBeNull();
    // La navigation, elle, reste rendue : c'est le layout qui décide de
    // montrer ou non la barre, pas la barre elle-même.
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeDefined();
  });
});

describe("AppNavbar · page active", () => {
  it("signale le dashboard quand il est affiché", () => {
    renderNavbar(DASHBOARD_PATH);

    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Configuration" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("signale la configuration quand elle est affichée", () => {
    renderNavbar(CONFIG_PATH);

    expect(
      screen.getByRole("link", { name: "Configuration" }).getAttribute("aria-current"),
    ).toBe("page");
    // Le dashboard est servi sur « / », préfixe de toute autre adresse : sans
    // correspondance exacte, il resterait actif sur la page de configuration
    // et l'utilisateur ne saurait plus où il est.
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});

describe("AppNavbar · page active sur le diagnostic", () => {
  it("signale le diagnostic quand il est affiché", () => {
    renderNavbar(DIAGNOSTIC_PATH);

    expect(
      screen.getByRole("link", { name: "Diagnostic" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
