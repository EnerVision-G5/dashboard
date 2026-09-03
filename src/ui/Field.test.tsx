import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SelectField, TextField } from "./Field";

const OPTIONS = [
  { value: "SITE001", label: "Bureau Paris La Défense" },
  { value: "SITE002", label: "Usine Lyon Vénissieux" },
];

describe("TextField", () => {
  it("lie l'étiquette au champ, sans passer par un placeholder", () => {
    render(<TextField label="Identifiant" />);

    const champ = screen.getByLabelText("Identifiant");
    expect(champ).toBeInstanceOf(HTMLInputElement);
    expect(champ.getAttribute("placeholder")).toBeNull();
  });

  it("remonte la saisie", () => {
    const onChange = vi.fn();
    render(<TextField label="Identifiant" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Identifiant"), { target: { value: "dev.reader" } });

    expect(onChange).toHaveBeenCalled();
  });

  it("annonce l'erreur autrement que par la couleur", () => {
    render(<TextField label="Identifiant" error="Ce champ est obligatoire." />);

    const champ = screen.getByLabelText("Identifiant");
    expect(champ.getAttribute("aria-invalid")).toBe("true");
    const decrit = champ.getAttribute("aria-describedby");
    expect(decrit).not.toBeNull();
    expect(document.getElementById(decrit!)?.textContent).toBe("Ce champ est obligatoire.");
  });

  it("ne marque pas invalide un champ sans erreur", () => {
    render(<TextField label="Identifiant" />);

    expect(screen.getByLabelText("Identifiant").getAttribute("aria-invalid")).toBeNull();
  });

  it("rattache le texte d'aide au champ", () => {
    render(<TextField label="Identifiant" hint="Votre identifiant de connexion." />);

    const decrit = screen.getByLabelText("Identifiant").getAttribute("aria-describedby");
    expect(document.getElementById(decrit!)?.textContent).toBe("Votre identifiant de connexion.");
  });

  it("annonce l'obligation par aria-required, pas par un astérisque décoratif", () => {
    render(<TextField label="Identifiant" required />);

    const champ = screen.getByLabelText("Identifiant");
    expect(champ.getAttribute("aria-required")).toBe("true");
  });

  it("n'allonge pas le nom accessible du champ avec la marque d'obligation", () => {
    render(<TextField label="Identifiant" required />);

    // L'astérisque est aria-hidden : le champ reste trouvable par son seul
    // libellé, exactement comme un champ facultatif.
    expect(screen.getByLabelText("Identifiant")).toBeDefined();
  });

  it("génère un identifiant distinct par instance", () => {
    render(
      <>
        <TextField label="Identifiant" />
        <TextField label="Mot de passe" type="password" />
      </>,
    );

    const a = screen.getByLabelText("Identifiant").id;
    const b = screen.getByLabelText("Mot de passe").id;
    expect(a).not.toBe(b);
  });
});

describe("SelectField", () => {
  it("liste ses options", () => {
    render(<SelectField label="Site" options={OPTIONS} />);

    expect(screen.getByRole("option", { name: "Bureau Paris La Défense" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Usine Lyon Vénissieux" })).toBeDefined();
  });

  it("remonte la valeur choisie", () => {
    const onChange = vi.fn();
    render(<SelectField label="Site" options={OPTIONS} value="SITE001" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Site"), { target: { value: "SITE002" } });

    expect(onChange).toHaveBeenCalled();
  });

  it("affiche le libellé de remplacement quand la liste est vide", () => {
    render(<SelectField label="Site" options={[]} placeholder="Chargement des sites…" />);

    expect(screen.getByRole("option", { name: "Chargement des sites…" })).toBeDefined();
  });

  it("se laisse désactiver", () => {
    render(<SelectField label="Site" options={[]} disabled />);

    expect((screen.getByLabelText("Site") as HTMLSelectElement).disabled).toBe(true);
  });

  it("utilise un select natif, pour le clavier et les lecteurs d'écran", () => {
    render(<SelectField label="Site" options={OPTIONS} />);

    expect(screen.getByLabelText("Site")).toBeInstanceOf(HTMLSelectElement);
  });
});
