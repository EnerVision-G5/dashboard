import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MeasurePicker } from "./MeasurePicker";
import { measureOf } from "../lib/measures";

function renderPicker(key = "consumption") {
  const onSelect = vi.fn();
  render(<MeasurePicker measure={measureOf(key)} onSelect={onSelect} />);
  return { onSelect };
}

describe("MeasurePicker", () => {
  it("propose les six grandeurs avec leur unité", () => {
    renderPicker();

    expect(screen.getByRole("button", { name: /Consommation/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Tension/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Intensité/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Température/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Humidité/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /Facteur de puissance/ })).toBeDefined();
  });

  it("forme un seul réglage, nommé", () => {
    renderPicker();

    // Six boutons pour un seul choix : un lecteur d'écran doit l'annoncer
    // comme tel, pas comme six commandes indépendantes.
    expect(screen.getByRole("group", { name: "Grandeur" })).toBeDefined();
  });

  it("signale la grandeur active autrement que par la couleur", () => {
    renderPicker("temperature");

    // `aria-pressed` est le seul repère qu'un lecteur d'écran annonce.
    expect(
      screen.getByRole("button", { name: /Température/ }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /Consommation/ }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("remonte la grandeur choisie", () => {
    const { onSelect } = renderPicker();

    fireEvent.click(screen.getByRole("button", { name: /Tension/ }));

    expect(onSelect).toHaveBeenCalledWith("voltage");
  });
});
