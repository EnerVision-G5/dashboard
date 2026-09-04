/**
 * Navigation principale des écrans authentifiés (EV-50).
 *
 * Un seul endroit porte désormais l'identité du produit, l'utilisateur connecté
 * et la déconnexion : avant ce ticket, l'en-tête vivait dans
 * `SiteDashboardPage`, ce qui aurait donné deux barres et deux boutons de
 * déconnexion dès l'arrivée d'un second écran.
 *
 * Deux choix méritent d'être expliqués :
 *   - la page active n'est pas signalée par la seule couleur. Le design system
 *     interdit de faire porter un sens à la couleur seule ; l'état actif est
 *     donc doublé par le poids du texte, par un fond, et surtout par
 *     `aria-current="page"` que `NavLink` pose de lui-même — le seul repère
 *     qu'un lecteur d'écran puisse annoncer ;
 *   - les entrées sont déclarées en données et non en JSX répété. Une entrée
 *     qui s'ajoute — la page d'alertes d'EV-17, par exemple — n'a alors aucune
 *     classe à recopier, donc aucune occasion de diverger.
 */

import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { CONFIG_PATH, DASHBOARD_PATH } from "../routes/paths";

/** Entrée de la navigation principale. */
interface NavEntry {
  label: string;
  path: string;
  /**
   * Vrai si le lien ne doit être actif que sur son adresse exacte.
   *
   * Indispensable pour le dashboard, dont l'adresse est « / » : sans cela,
   * React Router le considère actif sur toutes les pages, l'utilisateur ne
   * sachant plus où il se trouve.
   */
  exact?: boolean;
}

/**
 * Entrées servies aujourd'hui, dans l'ordre d'apparition.
 *
 * Volontairement non exportée : un fichier de composant qui exporte aussi des
 * constantes casse le rafraîchissement à chaud de Vite, et rien au-dehors n'a
 * besoin de cette liste.
 */
const NAV_ENTRIES: NavEntry[] = [
  { label: "Dashboard", path: DASHBOARD_PATH, exact: true },
  { label: "Configuration", path: CONFIG_PATH },
];

const LINK_BASE = [
  "inline-flex min-h-9 items-center rounded-controle px-3 py-2 text-corps",
  "transition-colors duration-150 ease-etat",
].join(" ");

const LINK_ACTIVE = "bg-mesure-50 font-semibold text-mesure-900";
const LINK_IDLE = "font-medium text-ardoise-600 hover:bg-ardoise-100 hover:text-ardoise-900";

export function AppNavbar() {
  const { session, signOut } = useAuth();

  return (
    <header className="border-b border-ardoise-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <h1 className="text-titre-page font-semibold text-ardoise-900">
          Smart Energy Optimiser
        </h1>

        {/* `aria-label` nomme la région : une page peut porter plusieurs
            navigations, un lecteur d'écran doit pouvoir les distinguer. */}
        <nav aria-label="Navigation principale">
          <ul className="flex flex-wrap items-center gap-1">
            {NAV_ENTRIES.map((entry) => (
              <li key={entry.path}>
                <NavLink
                  to={entry.path}
                  end={entry.exact === true}
                  className={({ isActive }) =>
                    [LINK_BASE, isActive ? LINK_ACTIVE : LINK_IDLE].join(" ")
                  }
                >
                  {entry.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* La session est en principe toujours ouverte ici, le layout ne
            montant cette barre que derrière `RequireAuth`. Le test reste :
            afficher un bouton de déconnexion sans session à fermer serait un
            mensonge, et le composant doit rester montable seul. */}
        {session !== null && (
          <div className="ml-auto flex items-center gap-3 text-corps text-ardoise-600">
            <span>
              {session.claims.username}
              {session.claims.role !== null && ` · ${session.claims.role}`}
            </span>
            <Button variant="secondaire" size="sm" onClick={signOut}>
              Se déconnecter
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
