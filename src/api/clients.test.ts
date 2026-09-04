import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { attachAuth, getApiClient } from "./clients";
import { closeSession, getSession, openSession } from "../auth/session";

function toBase64Url(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

const NOW = new Date("2026-09-03T10:00:00Z");

function makeToken(username: string): string {
  return `${toBase64Url({ alg: "HS256" })}.${toBase64Url({
    sub: username,
    role: "reader",
    exp: NOW.getTime() / 1000 + 3600,
  })}.signature`;
}

/** Joue la chaîne de requête d'un client sans émettre d'appel réseau. */
async function runRequestInterceptors(
  client: ReturnType<typeof axios.create>,
): Promise<Record<string, unknown>> {
  const handlers = (
    client.interceptors.request as unknown as {
      handlers: { fulfilled: (config: unknown) => unknown }[];
    }
  ).handlers;
  let config: unknown = { headers: new axios.AxiosHeaders() };
  for (const handler of handlers) {
    config = await handler.fulfilled(config);
  }
  return (config as { headers: { toJSON: () => Record<string, unknown> } }).headers.toJSON();
}

/** Joue la chaîne d'erreur de réponse d'un client. */
async function runResponseError(
  client: ReturnType<typeof axios.create>,
  status: number,
): Promise<void> {
  const handlers = (
    client.interceptors.response as unknown as {
      handlers: { rejected: (error: unknown) => unknown }[];
    }
  ).handlers;
  for (const handler of handlers) {
    await Promise.resolve(handler.rejected({ response: { status } })).catch(() => {});
  }
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  closeSession();
});

describe("attachAuth", () => {
  it("n'ajoute aucun en-tête Authorization sans session ouverte", async () => {
    const headers = await runRequestInterceptors(attachAuth(axios.create()));

    expect(headers.Authorization).toBeUndefined();
  });

  it("signe la requête avec le jeton de la session courante", async () => {
    const token = makeToken("dev.reader");
    openSession(token, NOW);

    const headers = await runRequestInterceptors(attachAuth(axios.create()));

    expect(headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("relit le jeton à chaque requête plutôt que de le figer à la création", async () => {
    const client = attachAuth(axios.create());
    openSession(makeToken("dev.reader"), NOW);
    await runRequestInterceptors(client);

    const second = makeToken("dev.writer");
    openSession(second, NOW);

    expect((await runRequestInterceptors(client)).Authorization).toBe(`Bearer ${second}`);
  });

  it("ferme la session sur un 401, ce qui ramène au formulaire de connexion", async () => {
    openSession(makeToken("dev.reader"), NOW);

    await runResponseError(attachAuth(axios.create()), 401);

    expect(getSession()).toBeNull();
  });

  it("laisse la session ouverte sur une erreur qui n'est pas un 401", async () => {
    openSession(makeToken("dev.reader"), NOW);

    await runResponseError(attachAuth(axios.create()), 503);

    expect(getSession()).not.toBeNull();
  });
});

describe("getApiClient", () => {
  it("mémorise l'instance pour une même base", () => {
    expect(getApiClient()).toBe(getApiClient());
  });
});
