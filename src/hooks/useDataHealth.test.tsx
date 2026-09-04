import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useDataHealth } from "./useDataHealth";
import { ApiError } from "../api/http";
import { makeSensorHealth, makeSiteIndicators } from "../test/doubles";

const fetchIndicators = vi.hoisted(() => vi.fn());
const fetchSensors = vi.hoisted(() => vi.fn());

vi.mock("../api/indicators", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/indicators")>()),
  fetchIndicators,
}));
vi.mock("../api/sensors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sensors")>()),
  fetchSensors,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { health, isLoading, indicatorsError, sensorsError } = useDataHealth(
    siteId,
    (id) => `Site ${id}`,
  );
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : "prêt"}</span>
      <span data-testid="level">{health?.level ?? "aucun"}</span>
      <span data-testid="constats">{health?.findings.length ?? -1}</span>
      <span data-testid="erreurs">{`${indicatorsError ?? "-"} | ${sensorsError ?? "-"}`}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  fetchIndicators.mockResolvedValue([makeSiteIndicators()]);
  fetchSensors.mockResolvedValue([makeSensorHealth()]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchIndicators.mockReset();
  fetchSensors.mockReset();
});

describe("useDataHealth", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchIndicators).not.toHaveBeenCalled();
    expect(fetchSensors).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("lit le parc entier et les capteurs du site affiché", async () => {
    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("level").textContent).toBe("ok");
    });
    expect(fetchSensors).toHaveBeenCalledWith(
      expect.anything(),
      "SITE-001",
      expect.anything(),
    );
  });

  it("garde les indicateurs quand seuls les capteurs échouent", async () => {
    fetchSensors.mockRejectedValue(new ApiError("Site introuvable.", 404));

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("erreurs").textContent).toBe("- | Site introuvable.");
    });
    // La synthèse existe malgré l'échec : le bandeau reste utile.
    expect(screen.getByTestId("level").textContent).toBe("ok");
  });

  it("garde les capteurs quand seuls les indicateurs échouent", async () => {
    fetchIndicators.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));
    fetchSensors.mockResolvedValue([
      makeSensorHealth({ statut: "failing", overall: "degraded" }),
    ]);

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("level").textContent).toBe("degraded");
    });
    expect(screen.getByTestId("erreurs").textContent).toBe(
      "L'API métier est injoignable. | -",
    );
    expect(screen.getByTestId("constats").textContent).toBe("1");
  });

  it("n'expose pas l'état du site précédent pendant un changement de site", async () => {
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("level").textContent).toBe("ok");
    });

    let resolveSensors: (value: unknown) => void = () => {};
    fetchSensors.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSensors = resolve;
        }),
    );

    rerender(<Probe siteId="SITE-002" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("level").textContent).toBe("aucun");

    resolveSensors([makeSensorHealth({ site_id: "SITE-002" })]);
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("prêt");
    });
  });
});
