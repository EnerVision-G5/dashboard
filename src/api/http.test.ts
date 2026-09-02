import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { ApiError, toApiError } from "./http";

function httpError(status: number, detail?: string): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = {
    status,
    statusText: "",
    data: detail === undefined ? {} : { detail },
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
  return error;
}

describe("toApiError", () => {
  it("nomme le service injoignable quand aucune réponse n'arrive", () => {
    const error = toApiError(new AxiosError("Network Error"), "L'API métier");

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeNull();
    expect(error.message).toContain("L'API métier est injoignable");
  });

  it("renvoie le détail du contrat sur un 404", () => {
    const error = toApiError(httpError(404, "Site inconnu : SITE-999."), "L'API métier");

    expect(error.status).toBe(404);
    expect(error.message).toBe("Site inconnu : SITE-999.");
  });

  it("explique un 501 comme un endpoint non encore implémenté", () => {
    const error = toApiError(httpError(501, "Contrat EV-06 uniquement."), "Le service d'inférence");

    expect(error.status).toBe(501);
    expect(error.message).toContain("n'implémente pas encore cet endpoint (501)");
  });

  it("renvoie vers EV-12 sur un 401", () => {
    expect(toApiError(httpError(401), "L'API métier").message).toContain("EV-12");
  });

  it("signale un service temporairement indisponible sur un 503", () => {
    expect(toApiError(httpError(503), "L'API métier").message).toContain("indisponible (503)");
  });

  it("reprend le détail d'un 422", () => {
    const error = toApiError(httpError(422, "start_time doit être antérieur."), "L'API métier");

    expect(error.message).toContain("start_time doit être antérieur.");
  });
});
