import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useModelRegistry } from "./useModelRegistry";
import { ApiError } from "../api/http";
import { makeModel } from "../test/doubles";

const fetchModels = vi.hoisted(() => vi.fn());
const fetchCurrentModel = vi.hoisted(() => vi.fn());

vi.mock("../api/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/models")>()),
  fetchModels,
  fetchCurrentModel,
}));

function Probe() {
  const { current, models, isLoading, error, currentError } = useModelRegistry();
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : "prêt"}</span>
      <span data-testid="promu">{current?.version ?? "aucun"}</span>
      <span data-testid="registre">{models.length}</span>
      <span data-testid="erreurs">{`${error ?? "-"} | ${currentError ?? "-"}`}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  fetchModels.mockResolvedValue([makeModel()]);
  fetchCurrentModel.mockResolvedValue(makeModel());
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchModels.mockReset();
  fetchCurrentModel.mockReset();
});

describe("useModelRegistry", () => {
  it("lit le registre et le modèle promu", async () => {
    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("prêt");
    });
    expect(screen.getByTestId("promu").textContent).toBe("3");
    expect(screen.getByTestId("registre").textContent).toBe("1");
  });

  it("traduit le 404 du modèle promu en absence, pas en erreur", async () => {
    fetchCurrentModel.mockRejectedValue(new ApiError("Aucun modèle promu.", 404));

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("prêt");
    });
    expect(screen.getByTestId("promu").textContent).toBe("aucun");
    // Le registre reste lisible, et aucune erreur n'est remontée : le registre
    // MLflow vide est une situation normale.
    expect(screen.getByTestId("erreurs").textContent).toBe("- | -");
    expect(screen.getByTestId("registre").textContent).toBe("1");
  });

  it("remonte les autres codes comme des erreurs", async () => {
    fetchCurrentModel.mockRejectedValue(
      new ApiError("L'API métier a renvoyé une erreur serveur (500).", 500),
    );

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("erreurs").textContent).toBe(
        "- | L'API métier a renvoyé une erreur serveur (500).",
      );
    });
  });

  it("garde le modèle promu quand seul le registre échoue", async () => {
    fetchModels.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("promu").textContent).toBe("3");
    });
    expect(screen.getByTestId("erreurs").textContent).toBe(
      "L'API métier est injoignable. | -",
    );
  });
});
