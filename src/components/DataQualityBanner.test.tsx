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

describe("DataQualityBanner · densité (EV-56)", () => {
  /** Un parc de sept sites, dont chacun produit plusieurs constats. */
  function parcAgite() {
    return buildDataHealth({
      indicators: Array.from({ length: 7 }, (_, index) =>
        makeSiteIndicators({
          site_id: `SITE-00${index + 1}`,
          quality: {
            ...makeSiteIndicators().quality,
            qualified: 0,
            qualified_ratio: 0,
            degraded_ratio: 0.99,
            exceeds_threshold: true,
            sensor_failure: 28,
          },
        }),
      ),
      sensors: [],
    });
  }

  it("n'affiche d'emblée que les trois constats les plus graves", () => {
    renderBanner({ health: parcAgite() });

    // Vingt et un constats occupaient la moitié de l'écran et repoussaient
    // hors de vue les panneaux que le bandeau est censé qualifier.
    const visibles = screen
      .getByRole("region", { name: "Fraîcheur et qualité des données" })
      .querySelectorAll("ul > li");
    expect(visibles.length).toBeGreaterThan(0);
    expect(screen.getByText(/18 autre\(s\) constat\(s\) sur 7 site\(s\)/)).toBeDefined();
  });

  it("garde les autres constats accessibles, repliés et défilants", () => {
    renderBanner({ health: parcAgite() });

    const detail = screen.getByRole("group");
    expect(detail.hasAttribute("open")).toBe(false);
    // Repliés mais présents : rien n'est perdu, seulement rangé.
    expect(
      screen.getByRole("region", { name: "Détail des constats de qualité" }),
    ).toBeDefined();
  });

  it("ne replie rien quand les constats tiennent à l'écran", () => {
    renderBanner({
      health: buildDataHealth({
        indicators: [
          makeSiteIndicators({
            quality: { ...makeSiteIndicators().quality, sensor_failure: 3 },
          }),
        ],
        sensors: [],
      }),
    });

    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.queryByText(/autre\(s\) constat/)).toBeNull();
  });
});
