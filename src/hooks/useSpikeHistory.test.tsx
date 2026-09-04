import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSpikeHistory } from "./useSpikeHistory";
import { ApiError } from "../api/http";
import { makeSpikeSimulation } from "../test/doubles";

const fetchSpikes = vi.hoisted(() => vi.fn());
vi.mock("../api/simulations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/simulations")>()),
  fetchSpikes,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { spikes, isLoading, error, reload } = useSpikeHistory(siteId);
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : (error ?? "prêt")}</span>
      <span data-testid="pics">{spikes.length}</span>
      <button type="button" onClick={reload}>
        relire
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  fetchSpikes.mockResolvedValue([makeSpikeSimulation()]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpikes.mockReset();
});

describe("useSpikeHistory", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchSpikes).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("lit l'historique du site demandé", async () => {
    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("pics").textContent).toBe("1");
    });
    expect(fetchSpikes).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("relit sur demande, sans minuteur", async () => {
    render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(fetchSpikes).toHaveBeenCalledTimes(1);
    });

    fetchSpikes.mockResolvedValue([makeSpikeSimulation(), makeSpikeSimulation()]);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "relire" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("pics").textContent).toBe("2");
    });
    expect(fetchSpikes).toHaveBeenCalledTimes(2);
  });

  it("expose l'erreur sans garder un historique périmé", async () => {
    fetchSpikes.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("L'API métier est injoignable.");
    });
    expect(screen.getByTestId("pics").textContent).toBe("0");
  });

  it("n'expose pas l'historique du site précédent pendant un changement", async () => {
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("pics").textContent).toBe("1");
    });

    let resolve: (value: unknown) => void = () => {};
    fetchSpikes.mockImplementation(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );

    rerender(<Probe siteId="SITE-002" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("pics").textContent).toBe("0");

    resolve([]);
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("prêt");
    });
  });
});
