import { describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosInstance } from "axios";
import { INVALID_CREDENTIALS_MESSAGE, TOKEN_PATH, requestToken } from "./auth";
import { ApiError } from "./http";

const TOKEN = {
  access_token: "entete.charge.signature",
  token_type: "bearer" as const,
  expires_in: 3600,
};

/** Client minimal : `requestToken` n'utilise que `post`. */
function clientPosting(handler: (url: string, body: unknown, config: unknown) => unknown) {
  const calls: { url: string; body: unknown; config: unknown }[] = [];
  const instance = {
    post: (url: string, body: unknown, config: unknown) => {
      calls.push({ url, body, config });
      const result = handler(url, body, config);
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve({ data: result });
    },
  } as unknown as AxiosInstance;
  return { instance, calls };
}

function httpError(status: number, detail?: string): AxiosError {
  const error = new AxiosError("refus");
  error.response = {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: detail === undefined ? {} : { detail },
  };
  return error;
}

describe("requestToken", () => {
  it("poste le formulaire attendu par le flux OAuth2 mot de passe", async () => {
    const { instance, calls } = clientPosting(() => TOKEN);

    await requestToken({ client: instance, username: "dev.reader", password: "s3cret" });

    expect(calls[0].url).toBe(TOKEN_PATH);
    expect(calls[0].body).toBeInstanceOf(URLSearchParams);
    expect((calls[0].body as URLSearchParams).get("username")).toBe("dev.reader");
    expect((calls[0].body as URLSearchParams).get("password")).toBe("s3cret");
    expect((calls[0].config as { headers: Record<string, string> }).headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  it("rend le jeton délivré par le contrat", async () => {
    const { instance } = clientPosting(() => TOKEN);

    await expect(
      requestToken({ client: instance, username: "dev.reader", password: "s3cret" }),
    ).resolves.toEqual(TOKEN);
  });

  it("traduit un 401 en identifiants refusés, pas en session expirée", async () => {
    const { instance } = clientPosting(() => httpError(401, "Identifiants invalides."));

    await expect(
      requestToken({ client: instance, username: "dev.reader", password: "faux" }),
    ).rejects.toMatchObject({ message: INVALID_CREDENTIALS_MESSAGE, status: 401 });
  });

  it("laisse remonter une panne de l'API telle qu'elle est décrite", async () => {
    const { instance } = clientPosting(() => httpError(503));

    const caught = await requestToken({
      client: instance,
      username: "dev.reader",
      password: "s3cret",
    }).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(503);
    expect((caught as ApiError).message).toContain("indisponible (503)");
  });
});
