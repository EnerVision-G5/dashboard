import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpikeHistoryPanel } from "./SpikeHistoryPanel";
import { makeSpikeSimulation } from "../test/doubles";

describe("SpikeHistoryPanel", () => {
  it("annonce le chargement", () => {
    render(<SpikeHistoryPanel spikes={[]} isLoading error={null} />);

    expect(screen.getByRole("status").textContent).toContain("Lecture des pics simulés");
  });

  it("affiche l'erreur de l'API", () => {
    render(
      <SpikeHistoryPanel spikes={[]} isLoading={false} error="L'API métier est injoignable." />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Historique des pics indisponible",
    );
  });

  it("explique un historique vide sans le confondre avec une erreur", () => {
    render(<SpikeHistoryPanel spikes={[]} isLoading={false} error={null} />);

    expect(screen.getByText("Aucun pic simulé sur ce site.")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("affiche la durée, l'auteur et la consommation constatée", () => {
    render(
      <SpikeHistoryPanel spikes={[makeSpikeSimulation()]} isLoading={false} error={null} />,
    );

    expect(screen.getByText("30 min · spike")).toBeDefined();
    expect(screen.getByText(/demandé par dev.writer/)).toBeDefined();
    expect(screen.getByText(/Consommation constatée : 812 kW/)).toBeDefined();
    expect(screen.getByText(/qualité good/)).toBeDefined();
  });

  it("dit qu'aucun relevé n'a été renvoyé plutôt que d'afficher zéro", () => {
    render(
      <SpikeHistoryPanel
        spikes={[
          makeSpikeSimulation({
            consumption_kw_constatee: null,
            data_quality_constatee: null,
          }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    expect(
      screen.getByText("Aucun relevé renvoyé par la source au déclenchement."),
    ).toBeDefined();
    expect(screen.queryByText(/0 kW/)).toBeNull();
  });

  it("affiche le message de la source quand il y en a un", () => {
    render(
      <SpikeHistoryPanel
        spikes={[makeSpikeSimulation({ message: "pic déjà en cours sur ce site" })]}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("pic déjà en cours sur ce site")).toBeDefined();
  });

  it("liste plusieurs épisodes dans l'ordre servi par l'API", () => {
    render(
      <SpikeHistoryPanel
        spikes={[
          makeSpikeSimulation({ simulation_id: 2, duration_minutes: 15 }),
          makeSpikeSimulation({ simulation_id: 1, duration_minutes: 45 }),
        ]}
        isLoading={false}
        error={null}
      />,
    );

    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(items[0]).toContain("15 min");
    expect(items[1]).toContain("45 min");
  });
});
