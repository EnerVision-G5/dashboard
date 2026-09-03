import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STORAGE_KEY,
  closeSession,
  getSession,
  getToken,
  openSession,
  restoreSession,
  subscribeToSession,
} from "./session";

function toBase64Url(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function makeToken(payload: unknown): string {
  return `${toBase64Url({ alg: "HS256" })}.${toBase64Url(payload)}.signature`;
}

const NOW = new Date("2026-09-03T10:00:00Z");
const VALID = makeToken({
  sub: "dev.reader",
  role: "reader",
  exp: NOW.getTime() / 1000 + 3600,
});

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  closeSession();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("session", () => {
  it("n'expose aucune session au départ", () => {
    expect(getSession()).toBeNull();
    expect(getToken()).toBeNull();
  });

  it("ouvre une session et expose le jeton et ses revendications", () => {
    const session = openSession(VALID, NOW);

    expect(session?.claims.username).toBe("dev.reader");
    expect(getToken()).toBe(VALID);
  });

  it("refuse un jeton déjà échu et laisse la session fermée", () => {
    const expired = makeToken({ sub: "dev.reader", exp: NOW.getTime() / 1000 - 1 });

    expect(openSession(expired, NOW)).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("refuse un jeton illisible", () => {
    expect(openSession("pas-un-jeton", NOW)).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("ferme la session ouverte quand un jeton invalide se présente", () => {
    openSession(VALID, NOW);

    openSession("pas-un-jeton", NOW);

    expect(getSession()).toBeNull();
  });

  it("prévient les abonnés à l'ouverture et à la fermeture", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);

    openSession(VALID, NOW);
    closeSession();
    unsubscribe();
    openSession(VALID, NOW);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ token: VALID }));
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });

  it("ne notifie pas une fermeture alors qu'aucune session n'est ouverte", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSession(listener);

    closeSession();
    unsubscribe();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("persistance de la session", () => {
  it("écrit le jeton dans sessionStorage à l'ouverture", () => {
    openSession(VALID, NOW);

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(VALID);
  });

  it("n'écrit jamais dans localStorage, que l'OWASP déconseille pour un jeton", () => {
    openSession(VALID, NOW);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("efface le jeton du stockage à la déconnexion", () => {
    openSession(VALID, NOW);

    closeSession();

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("n'écrit rien quand le jeton présenté est refusé", () => {
    openSession("pas-un-jeton", NOW);

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("préfixe sa clé pour ne pas entrer en collision sur localhost", () => {
    expect(STORAGE_KEY.startsWith("enervision.")).toBe(true);
  });
});

describe("restoreSession", () => {
  it("ne rend rien quand le stockage est vide", () => {
    expect(restoreSession(NOW)).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("rouvre la session laissée par un chargement précédent", () => {
    sessionStorage.setItem(STORAGE_KEY, VALID);

    const session = restoreSession(NOW);

    expect(session?.claims.username).toBe("dev.reader");
    expect(getToken()).toBe(VALID);
  });

  it("refuse un jeton stocké échu et le retire du stockage", () => {
    const expired = makeToken({ sub: "dev.reader", exp: NOW.getTime() / 1000 - 1 });
    sessionStorage.setItem(STORAGE_KEY, expired);

    expect(restoreSession(NOW)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("refuse un jeton stocké trafiqué et le retire du stockage", () => {
    sessionStorage.setItem(STORAGE_KEY, "valeur.posee.a.la.main");

    expect(restoreSession(NOW)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ne lève pas quand le navigateur refuse l'accès au stockage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("accès aux données de site bloqué");
    });

    expect(() => restoreSession(NOW)).not.toThrow();
    expect(getSession()).toBeNull();
  });

  it("garde la session en mémoire même si l'écriture échoue", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota dépassé");
    });

    expect(openSession(VALID, NOW)?.claims.username).toBe("dev.reader");
    expect(getToken()).toBe(VALID);
  });
});
