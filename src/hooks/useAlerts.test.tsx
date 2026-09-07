import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { ALERTS_REFRESH_INTERVAL_MS, useAlerts } from "./useAlerts";
import { ApiError } from "../api/http";
import { makeAlert } from "../test/doubles";

const fetchAlerts = vi.hoisted(() => vi.fn());
vi.mock("../api/alerts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/alerts")>()),
  fetchAlerts,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { alerts, isLoading, error, windowHours } = useAlerts(siteId);
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : (error ?? "prêt")}</span>
      <span data-testid="alertes">{alerts.length}</span>
      <span data-testid="fenetre">{windowHours}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchAlerts.mockResolvedValue([makeAlert()]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fetchAlerts.mockReset();
});

describe("useAlerts", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchAlerts).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("lit les alertes du site sur une fenêtre bornée", async () => {
    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("alertes").textContent).toBe("1");
    });
    expect(screen.getByTestId("fenetre").textContent).toBe("24");
    // La fenêtre est passée à l'API : sans elle, un site aux cent incidents
    // noierait celui de cette nuit.
    expect(fetchAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "SITE-001",
        startTime: expect.any(String),
        endTime: expect.any(String),
      }),
    );
  });

  it("rafraîchit sans intervention, comme le ticket le demande", async () => {
    render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(fetchAlerts).toHaveBeenCalledTimes(1);
    });

    fetchAlerts.mockResolvedValue([makeAlert({ alert_id: "1" }), makeAlert({ alert_id: "2" })]);
    await act(async () => {
      vi.advanceTimersByTime(ALERTS_REFRESH_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId("alertes").textContent).toBe("2");
    });
  });

  it("fait glisser la fenêtre avec l'horloge", async () => {
    render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(fetchAlerts).toHaveBeenCalledTimes(1);
    });
    const premiere = fetchAlerts.mock.calls[0][0].endTime;

    await act(async () => {
      vi.advanceTimersByTime(ALERTS_REFRESH_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(fetchAlerts).toHaveBeenCalledTimes(2);
    });
    // Une fenêtre figée à l'ouverture de la page finirait par ignorer les
    // alertes les plus récentes.
    expect(fetchAlerts.mock.calls[1][0].endTime).not.toBe(premiere);
  });

  it("efface la liste avec l'erreur plutôt que de la laisser périmée", async () => {
    fetchAlerts.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("L'API métier est injoignable.");
    });
    expect(screen.getByTestId("alertes").textContent).toBe("0");
  });

  it("n'expose pas les alertes du site précédent pendant un changement", async () => {
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("alertes").textContent).toBe("1");
    });

    let resolve: (value: unknown) => void = () => {};
    fetchAlerts.mockImplementation(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );

    rerender(<Probe siteId="SITE-002" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("alertes").textContent).toBe("0");

    resolve([]);
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("prêt");
    });
  });
});
