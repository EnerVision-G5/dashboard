import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useSites } from "./useSites";
import { ApiError } from "../api/http";
import { makeSite } from "../test/doubles";

const fetchSites = vi.hoisted(() => vi.fn());
vi.mock("../api/sites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/sites")>()),
  fetchSites,
}));

function Probe() {
  const { sites, selectedSite, selectSite, isLoading, error } = useSites();
  return (
    <div>
      <span data-testid="state">{isLoading ? "loading" : (error ?? "ready")}</span>
      <span data-testid="count">{sites.length}</span>
      <span data-testid="selected">{selectedSite?.site_id ?? "none"}</span>
      <button type="button" onClick={() => { selectSite("SITE-003"); }}>
        choisir
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://api.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSites.mockReset();
});

describe("useSites", () => {
  it("charge le référentiel et présélectionne le premier site actif", async () => {
    fetchSites.mockResolvedValue([
      makeSite({ site_id: "SITE-001", status: "maintenance" }),
      makeSite({ site_id: "SITE-002", status: "active" }),
    ]);

    render(<Probe />);

    expect(screen.getByTestId("state").textContent).toBe("loading");
    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("ready");
    });
    expect(screen.getByTestId("count").textContent).toBe("2");
    expect(screen.getByTestId("selected").textContent).toBe("SITE-002");
  });

  it("n'écrase pas le choix de l'utilisateur après la sélection initiale", async () => {
    fetchSites.mockResolvedValue([
      makeSite({ site_id: "SITE-002", status: "active" }),
      makeSite({ site_id: "SITE-003", status: "active" }),
    ]);

    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByTestId("selected").textContent).toBe("SITE-002");
    });

    act(() => {
      screen.getByRole("button", { name: "choisir" }).click();
    });

    expect(screen.getByTestId("selected").textContent).toBe("SITE-003");
  });

  it("expose le message d'erreur de l'API sans inventer de sites", async () => {
    fetchSites.mockRejectedValue(new ApiError("L'API métier est injoignable.", null));

    render(<Probe />);

    await waitFor(() => {
      expect(screen.getByTestId("state").textContent).toBe("L'API métier est injoignable.");
    });
    expect(screen.getByTestId("count").textContent).toBe("0");
  });
});
