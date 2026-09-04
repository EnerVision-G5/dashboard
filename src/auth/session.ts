/**
 * Session d'authentification du dashboard (EV-48).
 *
 * Le jeton est conservé dans `sessionStorage`, et nulle part ailleurs. Ce
 * choix est un compromis assumé entre trois possibilités :
 *
 *   - un cookie `httpOnly` serait hors d'atteinte de tout JavaScript, donc le
 *     plus sûr. Il est écarté faute de moyen : l'API délivre le jeton dans un
 *     corps JSON (flux OAuth2 mot de passe) et ne pose aucun cookie. L'y
 *     amener demande une évolution de l'API et du contrat ;
 *   - la mémoire seule ne survit pas à un rafraîchissement de page, ce qui
 *     renvoie au formulaire à chaque F5. C'était le comportement initial ;
 *   - `localStorage` survivrait à la fermeture de l'onglet et serait partagé
 *     entre onglets. C'est précisément ce que l'OWASP déconseille pour un
 *     jeton : il reste moissonnable longtemps après la session.
 *
 * `sessionStorage` garde la session au rafraîchissement, meurt avec l'onglet,
 * et n'est pas partagé entre onglets. Il reste lisible par un script injecté :
 * la parade au vol de jeton n'est pas le stockage mais l'absence de XSS, et la
 * durée de vie courte du jeton.
 *
 * Le store est volontairement hors de React : l'intercepteur Axios de
 * `src/api/clients.ts` doit pouvoir lire le jeton sans être un composant, et le
 * provider s'y abonne comme n'importe quel autre lecteur.
 */

import type { TokenClaims } from "./token";
import { decodeTokenClaims, isExpired } from "./token";

/**
 * Clé de stockage, préfixée par le produit.
 *
 * `sessionStorage` est partagé par toute l'origine : en développement, deux
 * applications servies sur `localhost` se marcheraient dessus sans ce préfixe.
 */
export const STORAGE_KEY = "enervision.auth.token";

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

/**
 * Accès au stockage, toujours sous `try`.
 *
 * `sessionStorage` lève, et ne rend pas simplement `null`, quand le navigateur
 * bloque les données de site (navigation privée durcie, réglage d'entreprise,
 * contexte sans origine). Une session non persistée est un désagrément ; un
 * écran blanc au chargement serait une panne.
 */
function readStored(): string | null {
  try {
    return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStored(token: string): void {
  try {
    globalThis.sessionStorage?.setItem(STORAGE_KEY, token);
  } catch {
    // Session non persistée : le jeton reste en mémoire pour cet onglet, et
    // le rafraîchissement renverra au formulaire. Dégradation acceptable.
  }
}

function clearStored(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire : il n'y avait rien à effacer, ou l'accès est refusé.
  }
}

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
  writeStored(token);
  notify();
  return current;
}

/**
 * Ferme la session et efface le jeton du stockage.
 *
 * Le stockage est vidé même sans session en mémoire : c'est ce qui permet à
 * `restoreSession` de se débarrasser d'un jeton échu trouvé au chargement.
 */
export function closeSession(): void {
  clearStored();
  if (current === null) {
    return;
  }
  current = null;
  notify();
}

/**
 * Rouvre la session laissée par un chargement précédent de la page.
 *
 * Le jeton stocké n'est jamais accordé sur parole : il repasse par le même
 * contrôle que celui délivré par l'API, échéance comprise. Un jeton échu,
 * tronqué ou trafiqué est effacé du stockage plutôt que porté sur des appels
 * qui reviendraient tous en 401.
 *
 * Ce contrôle est du confort, pas une sécurité : c'est l'API qui vérifie la
 * signature, et elle seule fait autorité.
 */
export function restoreSession(now: Date = new Date()): Session | null {
  const stored = readStored();
  if (stored === null) {
    return null;
  }
  return openSession(stored, now);
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
