/**
 * Bandeau d'information, d'avertissement ou d'erreur (EV-47).
 *
 * Distinct de `ErrorState` : celui-ci occupe la place d'un contenu qui aurait
 * dû s'afficher, l'`Alert` se pose au-dessus d'un contenu qui s'affiche quand
 * même. Le bandeau « Données de démonstration » en est le cas typique : les
 * mesures sont bien là, c'est la prédiction qui est simulée.
 *
 * Le libellé en capitales n'est pas décoratif : il nomme la nature du bandeau
 * pour qui parcourt l'écran des yeux sans le lire, et il porte le sens que la
 * couleur seule ne doit jamais porter.
 */

import type { ReactNode } from "react";

/** Nature du bandeau, jamais son apparence. */
export type AlertTone = "information" | "avertissement" | "erreur";

const TONES: Record<AlertTone, { surface: string; badge: string; role: "status" | "alert" }> = {
  information: {
    surface: "border-mesure-200 bg-mesure-50 text-mesure-900",
    badge: "bg-mesure-200 text-mesure-900",
    role: "status",
  },
  avertissement: {
    surface: "border-estimation-400 bg-estimation-50 text-estimation-900",
    badge: "bg-estimation-200 text-estimation-900",
    role: "status",
  },
  erreur: {
    surface: "border-alerte-300 bg-alerte-50 text-alerte-900",
    badge: "bg-alerte-200 text-alerte-900",
    role: "alert",
  },
};

interface AlertProps {
  tone?: AlertTone;
  /** Nature du bandeau, affichée en capitales. Porte le sens avec la couleur. */
  label: string;
  children: ReactNode;
}

export function Alert({ tone = "information", label, children }: AlertProps) {
  const { surface, badge, role } = TONES[tone];

  return (
    <div
      role={role}
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-surface border px-4 py-3 ${surface}`}
    >
      <span
        className={`rounded-controle px-2 py-0.5 text-annexe font-semibold tracking-wide uppercase ${badge}`}
      >
        {label}
      </span>
      <span className="text-corps">{children}</span>
    </div>
  );
}
