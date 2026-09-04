import { describe, expect, it } from "vitest";
import { decodeTokenClaims, isExpired } from "./token";

/** Encode un objet en base64url, comme le fait l'API en signant un jeton. */
function toBase64Url(payload: unknown): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Jeton de test : la signature n'est jamais vérifiée côté navigateur. */
function makeToken(payload: unknown): string {
  return `${toBase64Url({ alg: "HS256", typ: "JWT" })}.${toBase64Url(payload)}.signature`;
}

const EXPIRES_AT_SECONDS = 1_800_000_000;

describe("decodeTokenClaims", () => {
  it("lit l'identifiant, le rôle et l'échéance d'un jeton conforme", () => {
    const claims = decodeTokenClaims(
      makeToken({ sub: "dev.reader", role: "reader", exp: EXPIRES_AT_SECONDS }),
    );

    expect(claims).toEqual({
      username: "dev.reader",
      role: "reader",
      expiresAtMs: EXPIRES_AT_SECONDS * 1000,
    });
  });

  it("préserve un identifiant accentué", () => {
    const claims = decodeTokenClaims(makeToken({ sub: "maxime.chargé", role: "writer" }));

    expect(claims?.username).toBe("maxime.chargé");
  });

  it("ramène un rôle inconnu à null plutôt que de le propager", () => {
    const claims = decodeTokenClaims(makeToken({ sub: "dev.reader", role: "root" }));

    expect(claims?.role).toBeNull();
  });

  it("accepte un jeton sans échéance, qui n'expire alors jamais côté client", () => {
    const claims = decodeTokenClaims(makeToken({ sub: "dev.reader" }));

    expect(claims?.expiresAtMs).toBeNull();
  });

  it("refuse un jeton sans revendication sub, qui n'identifie personne", () => {
    expect(decodeTokenClaims(makeToken({ role: "reader" }))).toBeNull();
  });

  it("refuse un jeton qui n'a pas trois segments", () => {
    expect(decodeTokenClaims("pas-un-jeton")).toBeNull();
  });

  it("refuse une charge utile illisible sans lever d'exception", () => {
    expect(decodeTokenClaims("entete.@@@invalide@@@.signature")).toBeNull();
  });
});

describe("isExpired", () => {
  const claims = {
    username: "dev.reader",
    role: "reader" as const,
    expiresAtMs: EXPIRES_AT_SECONDS * 1000,
  };

  it("tient pour échu un jeton dont la date est passée", () => {
    expect(isExpired(claims, new Date(claims.expiresAtMs! + 1))).toBe(true);
  });

  it("tient pour valide un jeton dont la date est à venir", () => {
    expect(isExpired(claims, new Date(claims.expiresAtMs! - 1))).toBe(false);
  });

  it("n'expire jamais un jeton sans échéance", () => {
    expect(isExpired({ ...claims, expiresAtMs: null }, new Date())).toBe(false);
  });
});
