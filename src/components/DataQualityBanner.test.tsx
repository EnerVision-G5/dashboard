import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataQualityBanner } from "./DataQualityBanner";
import { buildDataHealth } from "../lib/dataHealth";
import { makeSensorHealth, makeSiteIndicators } from "../test/doubles";

/** Bandeau monté avec un parc sain, sauf indication contraire du test. */
function renderBanner(
  overrides: Partial<React.ComponentProps<typeof DataQualityBanner>> = {},
) {
  const health = buildDataHealth({
    indicators: [makeSiteIndicators()],
    sensors: [makeSensorHealth()],
  });
  render(
    <DataQualityBanner
      health={health}
      isLoading={false}
      indicatorsError={null}
      sensorsError={null}
      {...overrides}
    />,
  );
}

describe("DataQualityBanner", () => {
  it("annonce la vérification en cours", () => {
    renderBanner({ isLoading: true, health: null });

    const banner = screen.getByRole("region", {
      name: "Fraîcheur et qualité des données",
    });
    expect(banner.getAttribute("aria-busy")).toBe("true");
    expect(banner.textContent).toContain(
      "Vérification de la fraîcheur et de la qualité des données",
    );
  });

  it("reste affiché quand tout va bien, avec l'heure du dernier calcul", () => {
    renderBanner();

    const banner = screen.getByRole("region", {
      name: "Fraîcheur et qualité des données",
    });
    expect(banner.textContent).toContain("Données à jour");
    expect(banner.textContent).toContain("1 site(s) examiné(s)");
    // L'heure vient de `generated_at`, pas de l'horloge du navigateur.
    expect(banner.querySelector("time")?.getAttribute("dateTime")).toBe(
      "2026-09-02T12:00:00Z",
    );
  });

  it("détaille les constats d'un parc dégradé sans crier à l'incident", () => {
    renderBanner({
      health: buildDataHealth({
        indicators: [
          makeSiteIndicators({
            ingestion: {
              last_measure_at: "2026-09-02T10:00:00Z",
              last_ingested_at: "2026-09-02T10:00:30Z",
              measure_age_seconds: 7200,
              ingestion_lag_seconds: 30,
              is_stale: true,
              stale_threshold_seconds: 300,
              collector: null,
            },
          }),
        ],
        sensors: [],
      }),
    });

    expect(screen.getByRole("status").textContent).toContain("Données incomplètes");
    expect(screen.getByText(/dernière mesure il y a 2 h/)).toBeDefined();
    // Un retard d'ingestion n'interrompt pas la lecture : pas de role="alert".
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("interrompt la lecture quand un site ne mesure plus rien", () => {
    renderBanner({
      health: buildDataHealth({
        indicators: [
          makeSiteIndicators({
            ingestion: {
              last_measure_at: null,
              last_ingested_at: null,
              measure_age_seconds: null,
              ingestion_lag_seconds: null,
              is_stale: true,
              stale_threshold_seconds: 300,
              collector: null,
            },
          }),
        ],
        sensors: [],
      }),
    });

    expect(screen.getByRole("alert").textContent).toContain(
      "Données inexploitables sur au moins un site",
    );
    expect(screen.getByText(/n'a aucune mesure sur la fenêtre/)).toBeDefined();
  });

  it("garde ce qui a été lu quand seuls les capteurs échouent", () => {
    renderBanner({ sensorsError: "L'API métier est injoignable." });

    const banner = screen.getByRole("region", {
      name: "Fraîcheur et qualité des données",
    });
    expect(banner.textContent).toContain("Données à jour");
    expect(
      screen.getByText(/État des capteurs du site indisponible/),
    ).toBeDefined();
  });

  it("nomme le flux manquant quand seuls les indicateurs échouent", () => {
    renderBanner({ indicatorsError: "L'API métier a renvoyé une erreur serveur (500)." });

    expect(
      screen.getByText(/Fraîcheur et qualité du parc indisponibles/),
    ).toBeDefined();
  });

  it("ne prétend pas que tout va bien quand les deux flux sont tombés", () => {
    renderBanner({
      indicatorsError: "L'API métier est injoignable.",
      sensorsError: "L'API métier est injoignable.",
    });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Fraîcheur des données inconnue");
    expect(alert.textContent).toContain("ne peuvent pas être qualifiées");
    expect(screen.queryByText("Données à jour")).toBeNull();
  });

  it("dit son ignorance plutôt que de s'effacer quand rien n'est arrivé", () => {
    renderBanner({ health: null });

    expect(screen.getByRole("alert").textContent).toContain(
      "Fraîcheur des données inconnue",
    );
  });
});
