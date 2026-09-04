import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useSiteDiagnostics } from "./useSiteDiagnostics";
import { ApiError } from "../api/http";
import { makeSensorFailure, makeSiteIndicators } from "../test/doubles";

const fetchSiteIndicators = vi.hoisted(() => vi.fn());
const fetchSensorHistory = vi.hoisted(() => vi.fn());

vi.mock("../api/indicators", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/indicators")>()),
  fetchSiteIndicators,
}));
vi.mock("../api/sensors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sensors")>()),
  fetchSensorHistory,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { indicators, failures, isLoading, indicatorsError, failuresError } =
    useSiteDiagnostics(siteId);
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : "prêt"}</span>
      <span data-testid="site">{indicators?.site_id ?? "aucun"}</span>
      <span data-testid="pannes">{failures.length}</span>
      <span data-testid="erreurs">{`${indicatorsError ?? "-"} | ${failuresError ?? "-"}`}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  fetchSiteIndicators.mockResolvedValue(makeSiteIndicators());
  fetchSensorHistory.mockResolvedValue([makeSensorFailure()]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSiteIndicators.mockReset();
  fetchSensorHistory.mockReset();
});

describe("useSiteDiagnostics", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchSiteIndicators).not.toHaveBeenCalled();
    expect(fetchSensorHistory).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("lit les indicateurs et l'historique du site demandé", async () => {
    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-001");
    });
    expect(screen.getByTestId("pannes").textContent).toBe("1");
    expect(fetchSiteIndicators).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("garde les indicateurs quand seul l'historique échoue", async () => {
    fetchSensorHistory.mockRejectedValue(new ApiError("Site introuvable.", 404));

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("erreurs").textContent).toBe("- | Site introuvable.");
    });
    expect(screen.getByTestId("site").textContent).toBe("SITE-001");
  });

  it("garde l'historique quand seuls les indicateurs échouent", async () => {
    fetchSiteIndicators.mockRejectedValue(
      new ApiError("L'API métier est injoignable.", null),
    );

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("pannes").textContent).toBe("1");
    });
    expect(screen.getByTestId("erreurs").textContent).toBe(
      "L'API métier est injoignable. | -",
    );
    expect(screen.getByTestId("site").textContent).toBe("aucun");
  });

  it("n'expose pas les diagnostics du site précédent pendant un changement", async () => {
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-001");
    });

    let resolveIndicators: (value: unknown) => void = () => {};
    fetchSiteIndicators.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIndicators = resolve;
        }),
    );

    rerender(<Probe siteId="SITE-002" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("site").textContent).toBe("aucun");
    expect(screen.getByTestId("pannes").textContent).toBe("0");

    resolveIndicators(makeSiteIndicators({ site_id: "SITE-002" }));
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-002");
    });
  });
});
