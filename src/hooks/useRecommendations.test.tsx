import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import {
  RECOMMENDATIONS_REFRESH_INTERVAL_MS,
  useRecommendations,
} from "./useRecommendations";
import { ApiError } from "../api/http";
import { makeRecommendation, makeRecommendations } from "../test/doubles";

const fetchRecommendations = vi.hoisted(() => vi.fn());
vi.mock("../api/recommendations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/recommendations")>()),
  fetchRecommendations,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { recommendations, isLoading, error } = useRecommendations(siteId);
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : (error ?? "prêt")}</span>
      <span data-testid="site">{recommendations?.site_id ?? "aucun"}</span>
      <span data-testid="actions">{recommendations?.items.length ?? -1}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchRecommendations.mockResolvedValue(makeRecommendations());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fetchRecommendations.mockReset();
});

describe("useRecommendations", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchRecommendations).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("lit les recommandations du site demandé", async () => {
    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-001");
    });
    expect(screen.getByTestId("actions").textContent).toBe("1");
    expect(fetchRecommendations).toHaveBeenCalledWith(
      expect.objectContaining({ siteId: "SITE-001" }),
    );
  });

  it("efface les conseils avec l'erreur plutôt que de les laisser périmés", async () => {
    fetchRecommendations.mockRejectedValue(
      new ApiError("L'API métier est injoignable.", null),
    );

    render(<Probe siteId="SITE-001" />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("L'API métier est injoignable.");
    });
    expect(screen.getByTestId("site").textContent).toBe("aucun");
  });

  it("n'expose pas les conseils du site précédent pendant un changement", async () => {
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-001");
    });

    let resolve: (value: unknown) => void = () => {};
    fetchRecommendations.mockImplementation(
      () =>
        new Promise((accept) => {
          resolve = accept;
        }),
    );

    rerender(<Probe siteId="SITE-002" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("site").textContent).toBe("aucun");

    resolve(makeRecommendations({ site_id: "SITE-002", items: [] }));
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-002");
    });
    expect(screen.getByTestId("actions").textContent).toBe("0");
  });

  it("relit périodiquement, au rythme du job de prédiction", async () => {
    render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(fetchRecommendations).toHaveBeenCalledTimes(1);
    });

    fetchRecommendations.mockResolvedValue(
      makeRecommendations({ items: [makeRecommendation(), makeRecommendation()] }),
    );
    await act(async () => {
      vi.advanceTimersByTime(RECOMMENDATIONS_REFRESH_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId("actions").textContent).toBe("2");
    });
    expect(fetchRecommendations).toHaveBeenCalledTimes(2);
  });
});
