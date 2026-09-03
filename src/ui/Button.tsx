/**
 * Bouton du design system (EV-47).
 *
 * Quatre variantes, chacune avec un emploi. S'il faut deux boutons
 * « principal » sur un écran, c'est la hiérarchie de l'écran qui n'a pas été
 * tranchée : le système ne peut pas trancher à la place du concepteur, mais il
 * rend la faute visible.
 *
 * `className` n'est volontairement pas exposée. Un composant de système qui
 * accepte des classes arbitraires finit par recevoir `bg-purple-500`, et la
 * dérive que ce chantier corrige recommence. Le besoin de largeur pleine, seul
 * cas rencontré, passe par `fullWidth`.
 */

import type { ComponentProps, ReactNode } from "react";

/** Emploi du bouton, jamais son apparence. */
export type ButtonVariant = "principal" | "secondaire" | "discret" | "danger";

/** `md` par défaut ; `sm` réservé aux barres denses. */
export type ButtonSize = "md" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  principal:
    "bg-mesure-700 text-white hover:bg-mesure-800 disabled:bg-ardoise-300 disabled:text-ardoise-500",
  secondaire:
    "border border-ardoise-300 bg-white text-ardoise-700 hover:bg-ardoise-100 disabled:border-ardoise-200 disabled:text-ardoise-400 disabled:hover:bg-white",
  discret:
    "text-ardoise-600 hover:bg-ardoise-100 disabled:text-ardoise-400 disabled:hover:bg-transparent",
  danger:
    "bg-alerte-700 text-white hover:bg-alerte-800 disabled:bg-ardoise-300 disabled:text-ardoise-500",
};

const SIZES: Record<ButtonSize, string> = {
  // 36 px : la cible de pointage minimale fixée par le système.
  md: "min-h-9 px-4 py-2 text-corps",
  sm: "min-h-7 px-3 py-1 text-corps",
};

const BASE = [
  "inline-flex items-center justify-center gap-2 rounded-controle font-medium",
  "transition-colors duration-150 ease-etat",
  // Le focus n'est jamais retiré. L'anneau est posé globalement par
  // `:focus-visible` dans index.css, on ne le redéclare pas ici.
  "disabled:cursor-not-allowed",
].join(" ");

interface ButtonProps extends Omit<ComponentProps<"button">, "className" | "children"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Verrouille le bouton et remplace son libellé, sans le faire rétrécir. */
  isLoading?: boolean;
  /** Libellé affiché pendant le chargement. */
  loadingLabel?: string;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "principal",
  size = "md",
  isLoading = false,
  loadingLabel = "Chargement…",
  fullWidth = false,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    BASE,
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? "w-full" : "",
  ].join(" ");

  return (
    <button
      type={type}
      disabled={disabled === true || isLoading}
      // Le bouton n'est pas seulement désactivé : il attend une réponse. Un
      // lecteur d'écran doit pouvoir le dire.
      aria-busy={isLoading || undefined}
      className={classes}
      {...rest}
    >
      {/* Les deux libellés occupent la même cellule de grille : le bouton se
          dimensionne sur le plus large et ne bouge plus, quel que soit son
          état. Les doublures sont masquées aux technologies d'assistance. */}
      <span className="grid place-items-center">
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {children}
        </span>
        <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
          {loadingLabel}
        </span>
        <span className="col-start-1 row-start-1 whitespace-nowrap">
          {isLoading ? loadingLabel : children}
        </span>
      </span>
    </button>
  );
}
