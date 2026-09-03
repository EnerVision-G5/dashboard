import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { REFRESH_INTERVAL_MS, useLatestReading } from "./useLatestReading";
import { ApiError } from "../api/http";
import { makeReading } from "../test/doubles";

const fetchLatestReading = vi.hoisted(() => vi.fn());
vi.mock("../api/readings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/readings")>()),
  fetchLatestReading,
}));

function Probe({ siteId }: { siteId: string | null }) {
  const { reading, isLoading, error } = useLatestReading(siteId);
  return (
    <div>
      <span data-testid="state">{isLoading ? "chargement" : (error ?? "prêt")}</span>
      <span data-testid="kw">{reading?.consumption_kw ?? "aucune"}</span>
      <span data-testid="site">{reading?.site_id ?? "aucun"}</span>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fetchLatestReading.mockReset();
});

describe("useLatestReading", () => {
  it("n'appelle rien tant qu'aucun site n'est demandé", () => {
    render(<Probe siteId={null} />);

    expect(fetchLatestReading).not.toHaveBeenCalled();
    expect(screen.getByTestId("state").textContent).toBe("prêt");
  });

  it("charge la dernière mesure du site demandé", async () => {
    fetchLatestReading.mockResolvedValue(
      makeReading({ site_id: "SITE-001", consumption_kw: 2654 }),
    );

    render(<Probe siteId="SITE-001" />);

    expect(screen.getByTestId("state").textContent).toBe("chargement");
    await waitFor(() => {
      expect(screen.getByTestId("kw").textContent).toBe("2654");
    });
    expect(fetchLatestReading).toHaveBeenCalledWith(
      expect.anything(),
      "SITE-001",
      expect.anything(),
    );
  });

  it("rafraîchit la mesure à intervalle régulier", async () => {
    fetchLatestReading.mockResolvedValue(makeReading({ consumption_kw: 100 }));
    render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("kw").textContent).toBe("100");
    });

    fetchLatestReading.mockResolvedValue(makeReading({ consumption_kw: 101 }));
    await act(async () => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS);
    });

    await waitFor(() => {
      expect(screen.getByTestId("kw").textContent).toBe("101");
    });
  });

  it("n'affiche jamais la mesure d'un site sous le nom d'un autre", async () => {
    fetchLatestReading.mockResolvedValue(
      makeReading({ site_id: "SITE-001", consumption_kw: 100 }),
    );
    const { rerender } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-001");
    });

    let resolve: (value: unknown) => void = () => {};
    fetchLatestReading.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    rerender(<Probe siteId="SITE-002" />);

    // Pendant le chargement du second site, la mesure du premier a disparu.
    expect(screen.getByTestId("state").textContent).toBe("chargement");
    expect(screen.getByTestId("site").textContent).toBe("aucun");

    await act(async () => {
      resolve(makeReading({ site_id: "SITE-002", consumption_kw: 200 }));
    });
    await waitFor(() => {
      expect(screen.getByTestId("site").textContent).toBe("SITE-002");
    });
  });

  it("expose l'erreur et n'affiche plus de mesure d'âge inconnu", async () => {
    fetchLatestReading.mockRejectedValue(new ApiError("Site introuvable.", 404));

    render(<Probe siteId="SITE-999" />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("Site introuvable.");
    });
    expect(screen.getByTestId("kw").textContent).toBe("aucune");
  });

  it("arrête le rafraîchissement au démontage", async () => {
    fetchLatestReading.mockResolvedValue(makeReading());
    const { unmount } = render(<Probe siteId="SITE-001" />);
    await waitFor(() => {
      expect(fetchLatestReading).toHaveBeenCalledTimes(1);
    });

    unmount();
    await act(async () => {
      vi.advanceTimersByTime(REFRESH_INTERVAL_MS * 3);
    });

    expect(fetchLatestReading).toHaveBeenCalledTimes(1);
  });
});
