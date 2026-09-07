import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TimeRangePicker } from "./TimeRangePicker";
import { MAX_COVERED_HOURS } from "../lib/timeWindow";

const NOW = new Date("2026-09-04T12:00:00.000Z");
const WINDOW = {
  startTime: "2026-09-03T12:00:00.000Z",
  endTime: "2026-09-04T12:00:00.000Z",
};

function renderPicker(window = WINDOW) {
  const onApply = vi.fn();
  render(<TimeRangePicker window={window} onApply={onApply} now={() => NOW} />);
  return { onApply };
}

/** Valeur d'un `datetime-local` pour un instant ISO, en heure locale. */
function localValue(iso: string): string {
  const moment = new Date(iso);
  const offset = moment.getTimezoneOffset() * 60 * 1000;
  return new Date(moment.getTime() - offset).toISOString().slice(0, 16);
}

describe("TimeRangePicker · durées rapides", () => {
  it("propose les quatre durées du module", () => {
    renderPicker();

    for (const label of ["6 h", "24 h", "3 j", "7 j"]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("applique une durée qui finit à l'instant présent", () => {
    const { onApply } = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: "6 h" }));

    expect(onApply).toHaveBeenCalledWith({
      startTime: "2026-09-04T06:00:00.000Z",
      endTime: "2026-09-04T12:00:00.000Z",
    });
  });
});

describe("TimeRangePicker · bornes explicites", () => {
  it("part de la fenêtre appliquée", () => {
    renderPicker();

    expect((screen.getByLabelText("Début") as HTMLInputElement).value).toBe(
      localValue(WINDOW.startTime),
    );
    expect((screen.getByLabelText("Fin") as HTMLInputElement).value).toBe(
      localValue(WINDOW.endTime),
    );
  });

  it("applique la période saisie", () => {
    const { onApply } = renderPicker();

    fireEvent.change(screen.getByLabelText("Début"), {
      target: { value: localValue("2026-09-01T08:00:00.000Z") },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: localValue("2026-09-01T20:00:00.000Z") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    expect(onApply).toHaveBeenCalledWith({
      startTime: "2026-09-01T08:00:00.000Z",
      endTime: "2026-09-01T20:00:00.000Z",
    });
  });

  it("refuse des bornes inversées avant d'appeler l'API", () => {
    const { onApply } = renderPicker();

    fireEvent.change(screen.getByLabelText("Début"), {
      target: { value: localValue("2026-09-02T20:00:00.000Z") },
    });
    fireEvent.change(screen.getByLabelText("Fin"), {
      target: { value: localValue("2026-09-02T08:00:00.000Z") },
    });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    // Le contrat répondrait 422 : le dire avant l'appel est plus clair que de
    // traduire son refus ensuite.
    expect(screen.getByRole("alert").textContent).toBe(
      "La date de fin doit suivre la date de début.",
    );
    expect(onApply).not.toHaveBeenCalled();
  });

  it("refuse une période vide", () => {
    const { onApply } = renderPicker();
    const meme = localValue("2026-09-02T08:00:00.000Z");

    fireEvent.change(screen.getByLabelText("Début"), { target: { value: meme } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: meme } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    expect(screen.getByRole("alert").textContent).toContain("au moins quelques minutes");
    expect(onApply).not.toHaveBeenCalled();
  });

  it("refuse une date manquante", () => {
    const { onApply } = renderPicker();

    fireEvent.change(screen.getByLabelText("Début"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));

    expect(screen.getByRole("alert").textContent).toBe(
      "Les deux dates doivent être renseignées.",
    );
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("TimeRangePicker · profondeur non couverte", () => {
  it("n'avertit pas sur une fenêtre que la pagination couvre", () => {
    renderPicker();

    expect(screen.queryByText(/la pagination des mesures ne couvre pas/)).toBeNull();
  });

  it("avertit sans bloquer au-delà de ce que la pagination couvre", () => {
    const trop = {
      startTime: "2026-08-01T12:00:00.000Z",
      endTime: "2026-09-04T12:00:00.000Z",
    };

    renderPicker(trop);

    // 34 jours pour ~13 couverts : le graphique serait tronqué en silence.
    expect(screen.getByText(/la pagination des mesures ne couvre/)).toBeDefined();
    expect(MAX_COVERED_HOURS).toBe(333);
    // Un avertissement, pas un refus : la période reste appliquée.
    expect(screen.getByRole("button", { name: "Appliquer" })).toBeDefined();
  });
});
