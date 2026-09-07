import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEASURE,
  MEASURES,
  formatMeasure,
  measureOf,
  readMeasure,
  seriesLabel,
} from "./measures";
import { makeReading } from "../test/doubles";

describe("MEASURES", () => {
  it("décrit les six grandeurs du contrat, consommation d'abord", () => {
    expect(MEASURES.map((measure) => measure.key)).toEqual([
      "consumption",
      "voltage",
      "current",
      "temperature",
      "humidity",
      "powerFactor",
    ]);
  });

  it("ne déclare prédite que la consommation", () => {
    // Le contrat ne publie qu'un predicted_consumption_kw : le modèle ne
    // prévoit ni la température ni la tension.
    const predites = MEASURES.filter((measure) => measure.predicted);
    expect(predites.map((measure) => measure.key)).toEqual(["consumption"]);
  });
});

describe("measureOf", () => {
  it("rend le descripteur demandé", () => {
    expect(measureOf("temperature").unit).toBe("°C");
    expect(measureOf("voltage").field).toBe("voltage_v");
  });

  it("retombe sur la consommation devant une clé inconnue", () => {
    // La clé peut venir d'une main humaine : une faute de frappe ne doit pas
    // vider l'écran.
    expect(measureOf("tension").key).toBe(DEFAULT_MEASURE);
    expect(measureOf(null).key).toBe(DEFAULT_MEASURE);
    expect(measureOf(undefined).key).toBe(DEFAULT_MEASURE);
  });
});

describe("readMeasure", () => {
  it("lit la valeur du champ décrit par la grandeur", () => {
    const reading = makeReading({ voltage_v: 399.4, temperature_celsius: 7 });

    expect(readMeasure(reading, measureOf("voltage"))).toBe(399.4);
    expect(readMeasure(reading, measureOf("temperature"))).toBe(7);
  });

  it("rend null quand la source n'a pas servi la valeur", () => {
    const reading = makeReading({ humidity_percent: null });

    expect(readMeasure(reading, measureOf("humidity"))).toBeNull();
  });
});

describe("formatMeasure", () => {
  it("accole l'unité et respecte les décimales de la grandeur", () => {
    expect(formatMeasure(157, measureOf("consumption"))).toBe("157 kW");
    expect(formatMeasure(399.4, measureOf("voltage"))).toBe("399,4 V");
    expect(formatMeasure(0.95, measureOf("powerFactor"))).toBe("0,95");
  });

  it("rend un tiret cadratin sur une valeur absente, jamais un zéro", () => {
    expect(formatMeasure(null, measureOf("temperature"))).toBe("—");
  });
});

describe("seriesLabel", () => {
  it("garde le libellé historique de la consommation", () => {
    // La légende du graphique le porte depuis EV-16, et la recette y renvoie.
    expect(seriesLabel(measureOf("consumption"))).toBe("Consommation réelle (kW)");
  });

  it("nomme les autres grandeurs avec leur unité", () => {
    expect(seriesLabel(measureOf("temperature"))).toBe("Température (°C)");
  });

  it("n'invente pas d'unité pour le facteur de puissance", () => {
    expect(seriesLabel(measureOf("powerFactor"))).toBe("Facteur de puissance");
  });
});
