/**
 * Contexte d'authentification (EV-48).
 *
 * Le contexte et son type vivent dans leur propre module : un fichier qui
 * exporte à la fois un composant et autre chose casse le rafraîchissement à
 * chaud de React, ce que la règle `react-refresh/only-export-components` du
 * lint fait remonter.
 */

import { createContext } from "react";
import type { Session } from "./session";

/** Surface exposée aux écrans par `useAuth`. */
export interface AuthContextValue {
  /** Session courante, `null` si personne n'est connecté. */
  session: Session | null;
  /** Vrai dès qu'une session est ouverte. */
  isAuthenticated: boolean;
  /** Vrai pendant l'appel au flux OAuth2, pour l'état de chargement du formulaire. */
  isSigningIn: boolean;
  /** Message du dernier échec de connexion, `null` si le dernier essai a abouti. */
  error: string | null;
  /** Ouvre une session. Rend `true` si l'authentification a abouti. */
  signIn: (username: string, password: string) => Promise<boolean>;
  /** Ferme la session courante. */
  signOut: () => void;
}

/**
 * `null` par défaut : un composant rendu hors du provider est un bug de
 * câblage, que `useAuth` transforme en erreur explicite plutôt qu'en
 * comportement silencieusement dégradé.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);
