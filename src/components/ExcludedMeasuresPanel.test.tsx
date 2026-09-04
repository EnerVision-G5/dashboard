import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExcludedMeasuresPanel } from "./ExcludedMeasuresPanel";
import { UNSPECIFIED_EXCLUSION_REASON } from "../lib/series";
import type { ExclusionSummary } from "../lib/series";
import { makeSensorFailure } from "../test/doubles";

const AUCUNE: ExclusionSummary = { total: 0, reasons: [], firstAt: null, lastAt: null };

const DES_EXCLUSIONS: ExclusionSummary = {
  total: 131,
  reasons: [
    { reason: "temperature_sensor_failure", count: 128 },
    { reason: UNSPECIFIED_EXCLUSION_REASON, count: 3 },
  ],
  firstAt: "2026-09-02T08:00:00Z",
  lastAt: "2026-09-02T10:11:00Z",
};

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ExcludedMeasuresPanel>> = {},
) {
  render(
    <ExcludedMeasuresPanel
      exclusions={AUCUNE}
      failures={[]}
      isLoading={false}
      failuresError={null}
      windowHours={24}
      {...overrides}
    />,
  );
}

describe("ExcludedMeasuresPanel", () => {
  it("annonce le chargement des mesures de la fenêtre", () => {
    renderPanel({ isLoading: true });

    expect(screen.getByRole("status").textContent).toContain(
      "Lecture des mesures de la fenêtre",
    );
  });

  it("dit qu'aucune mesure n'a été écartée plutôt que d'afficher un zéro sec", () => {
    renderPanel();

    expect(screen.getByText("Aucune mesure écartée sur la fenêtre.")).toBeDefined();
  });

  it("compte les mesures écartées, par motif et sur leur plage", () => {
    renderPanel({ exclusions: DES_EXCLUSIONS });

    expect(screen.getByText("131")).toBeDefined();
    expect(screen.getByText("128 × temperature_sensor_failure")).toBeDefined();
    expect(screen.getByText(`3 × ${UNSPECIFIED_EXCLUSION_REASON}`)).toBeDefined();
  });

  it("rappelle qu'une mesure écartée reste tracée", () => {
    renderPanel({ exclusions: DES_EXCLUSIONS });

    expect(
      screen.getByText(/restent tracées sur le graphique, mais ne comptent pas/),
    ).toBeDefined();
  });

  it("annonce un historique vide sans le confondre avec une erreur", () => {
    renderPanel();

    expect(
      screen.getByText("Aucune panne de capteur enregistrée pour ce site."),
    ).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche une panne terminée avec ses deux bornes", () => {
    renderPanel({ failures: [makeSensorFailure()] });

    expect(screen.getByText("Capteur température")).toBeDefined();
    expect(screen.getByText(/Constatée le .* rétablie le /)).toBeDefined();
  });

  it("n'invente pas de fin à une panne en cours", () => {
    renderPanel({
      failures: [
        makeSensorFailure({ capteur: "network", ended_at: null, ongoing: true }),
      ],
    });

    expect(screen.getByText(/panne en cours/)).toBeDefined();
    expect(screen.getByText(/pas encore rétablie/)).toBeDefined();
  });

  it("distingue la date annoncée par la source du rétablissement constaté", () => {
    renderPanel({
      failures: [
        makeSensorFailure({
          ended_at: null,
          ongoing: true,
          failing_until: "2026-09-02T16:00:00Z",
        }),
      ],
    });

    expect(screen.getByText(/Rétablissement annoncé par la source/)).toBeDefined();
  });

  it("garde le résumé des exclusions quand seul l'historique échoue", () => {
    renderPanel({
      exclusions: DES_EXCLUSIONS,
      failuresError: "L'API métier est injoignable.",
    });

    expect(screen.getByText("131")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain(
      "Historique des pannes indisponible",
    );
  });
});
