import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IngestionPanel } from "./IngestionPanel";
import { makeSiteIndicators } from "../test/doubles";

const FRAIS = makeSiteIndicators().ingestion;

const EN_RETARD = makeSiteIndicators({
  ingestion: {
    last_measure_at: "2026-09-02T10:00:00Z",
    last_ingested_at: "2026-09-02T10:00:45Z",
    measure_age_seconds: 7200,
    ingestion_lag_seconds: 45,
    is_stale: true,
    stale_threshold_seconds: 300,
    collector: null,
  },
}).ingestion;

describe("IngestionPanel", () => {
  it("annonce le chargement", () => {
    render(<IngestionPanel ingestion={null} isLoading error={null} />);

    expect(screen.getByRole("status").textContent).toContain("Lecture de l'état de l'ingestion");
  });

  it("affiche l'erreur de l'API plutôt qu'un panneau vide", () => {
    render(
      <IngestionPanel
        ingestion={null}
        isLoading={false}
        error="L'API métier est injoignable."
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("État de l'ingestion indisponible");
    expect(alert.textContent).toContain("L'API métier est injoignable.");
  });

  it("distingue l'absence d'indicateur d'une erreur", () => {
    render(<IngestionPanel ingestion={null} isLoading={false} error={null} />);

    expect(screen.getByText("Aucun indicateur d'ingestion pour ce site.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sépare l'heure de la mesure de celle de son écriture en base", () => {
    render(<IngestionPanel ingestion={FRAIS} isLoading={false} error={null} />);

    expect(screen.getByText("Dernière mesure")).toBeDefined();
    expect(screen.getByText("Écrite en base")).toBeDefined();
    // Le délai d'ingestion est ce qui distingue une source muette d'une
    // collecte en retard.
    expect(screen.getByText("Délai d'ingestion")).toBeDefined();
    expect(screen.getByText("30 s")).toBeDefined();
  });

  it("affiche le seuil de l'API et le verdict quand tout va bien", () => {
    render(<IngestionPanel ingestion={FRAIS} isLoading={false} error={null} />);

    expect(screen.getByText("5 min")).toBeDefined();
    expect(
      screen.getByText("L'ingestion est dans les temps annoncés par l'API."),
    ).toBeDefined();
  });

  it("signale un retard en renvoyant au seuil de l'API", () => {
    render(<IngestionPanel ingestion={EN_RETARD} isLoading={false} error={null} />);

    expect(screen.getByText("2 h")).toBeDefined();
    expect(screen.getByText("L'ingestion est en retard sur le seuil de l'API.")).toBeDefined();
    // Un état de la donnée, pas un événement : rien n'interrompt la lecture.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dit qu'un site n'a aucune mesure plutôt qu'un retard", () => {
    render(
      <IngestionPanel
        ingestion={{
          ...EN_RETARD,
          last_measure_at: null,
          last_ingested_at: null,
          measure_age_seconds: null,
          ingestion_lag_seconds: null,
        }}
        isLoading={false}
        error={null}
      />,
    );

    expect(
      screen.getByText("Ce site n'a aucune mesure : l'ingestion n'a rien écrit."),
    ).toBeDefined();
    expect(screen.getByText("inconnu")).toBeDefined();
  });

  it("n'affiche aucun bloc collecteur quand l'API n'en sert pas", () => {
    render(<IngestionPanel ingestion={FRAIS} isLoading={false} error={null} />);

    expect(screen.queryByText(/Collecteur/)).toBeNull();
  });

  it("détaille l'état du collecteur quand l'API en sert un", () => {
    render(
      <IngestionPanel
        ingestion={{
          ...FRAIS,
          collector: {
            last_attempt_at: "2026-09-02T11:59:30Z",
            last_success_at: "2026-09-02T11:59:30Z",
            last_rows: 7,
            last_data_lag_seconds: 12,
            consecutive_failures: 0,
            last_error: "timeout sur la source",
            source: "poller",
          },
        }}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Collecteur (collecte continue)")).toBeDefined();
    expect(screen.getByText("Lignes au dernier essai abouti")).toBeDefined();
    expect(screen.getByText("7")).toBeDefined();
    // Sans échec en cours, l'erreur conservée est présentée comme résolue :
    // l'API la garde pour dire de quoi le site relève, pas qu'il est en panne.
    expect(
      screen.getByText(/Dernière erreur connue, depuis résolue : timeout sur la source/),
    ).toBeDefined();
  });

  it("présente l'erreur comme en cours quand le collecteur échoue en série", () => {
    render(
      <IngestionPanel
        ingestion={{
          ...FRAIS,
          collector: {
            last_attempt_at: "2026-09-02T11:59:30Z",
            last_success_at: "2026-09-02T09:00:00Z",
            last_rows: 7,
            last_data_lag_seconds: null,
            consecutive_failures: 12,
            last_error: "connexion refusée",
            source: "backfill",
          },
        }}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Collecteur (reprise)")).toBeDefined();
    expect(screen.getByText(/Erreur en cours : connexion refusée/)).toBeDefined();
    expect(screen.getByText("12")).toBeDefined();
  });
});

describe("IngestionPanel · densité (EV-56)", () => {
  const COLLECTEUR = {
    last_attempt_at: "2026-09-02T11:59:30Z",
    last_success_at: "2026-09-02T11:59:30Z",
    last_rows: 7,
    last_data_lag_seconds: 12,
    consecutive_failures: 0,
    last_error: null,
    source: "poller" as const,
  };

  it("replie l'état du collecteur, qui est un détail de diagnostic", () => {
    render(
      <IngestionPanel
        ingestion={{ ...FRAIS, collector: COLLECTEUR }}
        isLoading={false}
        error={null}
      />,
    );

    const bloc = screen.getByRole("group");
    expect(bloc.hasAttribute("open")).toBe(false);
    // Replié n'est pas absent : le contenu reste lisible et cherchable.
    expect(screen.getByText("Lignes au dernier essai abouti")).toBeDefined();
  });

  it("l'ouvre d'emblée quand le collecteur échoue", () => {
    render(
      <IngestionPanel
        ingestion={{
          ...FRAIS,
          collector: { ...COLLECTEUR, consecutive_failures: 12, last_error: "timeout" },
        }}
        isLoading={false}
        error={null}
      />,
    );

    // C'est alors l'information la plus utile de la carte.
    expect(screen.getByRole("group").hasAttribute("open")).toBe(true);
  });
});
