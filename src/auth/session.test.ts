import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeSession,
  getSession,
  getToken,
  openSession,
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

afterEach(() => {
  closeSession();
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
