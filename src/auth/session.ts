/**
 * Session d'authentification du dashboard (EV-48).
 *
 * Le jeton vit **en mémoire uniquement**, jamais dans `localStorage` ni dans
 * `sessionStorage` : c'est la règle du guide d'intégration front, et elle a une
 * raison. Un jeton posé dans le stockage du navigateur reste lisible par tout
 * script chargé sur l'origine, donc exfiltrable par une injection ; en mémoire,
 * il disparaît avec l'onglet. Le prix assumé est qu'un rechargement de page
 * ramène l'écran de connexion.
 *
 * Le store est volontairement hors de React : l'intercepteur Axios de
 * `src/api/clients.ts` doit pouvoir lire le jeton sans être un composant, et le
 * provider s'y abonne comme n'importe quel autre lecteur.
 */

import type { TokenClaims } from "./token";
import { decodeTokenClaims, isExpired } from "./token";

/** Session ouverte : le jeton et ce qu'il revendique. */
export interface Session {
  /** Jeton brut, à placer tel quel dans l'en-tête `Authorization`. */
  token: string;
  /** Revendications lues dans le jeton. */
  claims: TokenClaims;
}

type Listener = (session: Session | null) => void;

let current: Session | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of [...listeners]) {
    listener(current);
  }
}

/** Session courante, ou `null` si personne n'est connecté. */
export function getSession(): Session | null {
  return current;
}

/** Jeton courant, ou `null`. Raccourci pour l'intercepteur HTTP. */
export function getToken(): string | null {
  return current?.token ?? null;
}

/**
 * Ouvre une session à partir d'un jeton délivré par l'API.
 *
 * Un jeton illisible ou déjà échu n'ouvre rien : il est refusé, et la session
 * précédente est fermée. Mieux vaut renvoyer l'utilisateur au formulaire que
 * de le laisser sur un écran qui échouera en 401 à chaque appel.
 */
export function openSession(token: string, now: Date = new Date()): Session | null {
  const claims = decodeTokenClaims(token);
  if (claims === null || isExpired(claims, now)) {
    closeSession();
    return null;
  }
  current = { token, claims };
  notify();
  return current;
}

/** Ferme la session. Sans effet, et sans notification, s'il n'y en avait pas. */
export function closeSession(): void {
  if (current === null) {
    return;
  }
  current = null;
  notify();
}

/**
 * Abonne un lecteur aux changements de session et rend sa fonction de retrait.
 *
 * Signature compatible avec `useSyncExternalStore`, qui appelle l'abonnement
 * sans argument et attend une fonction de désabonnement.
 */
export function subscribeToSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
