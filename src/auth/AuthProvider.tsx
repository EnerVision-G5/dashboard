/**
 * Provider d'authentification (EV-48).
 *
 * Il fait le lien entre trois choses déjà indépendantes : le store de session
 * en mémoire, l'appel au flux OAuth2 mot de passe, et les écrans React. Il ne
 * détient lui-même aucun jeton — la source de vérité reste `src/auth/session`,
 * que l'intercepteur Axios lit de son côté.
 *
 * Pas de rafraîchissement silencieux du jeton. Le contrat gelé 1.0.0 ne publie
 * que le flux mot de passe, sans `refresh_token` : redemander un jeton exigerait
 * de garder le mot de passe en mémoire pendant toute la session, ce qui coûte
 * bien plus cher que la reconnexion que cela éviterait. À l'échéance, la
 * session est donc fermée et l'utilisateur revient au formulaire. Le jour où le
 * contrat publiera un flux de rafraîchissement, c'est ici que le minuteur
 * changera de geste.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { AuthContextValue } from "./AuthContext";
import { AuthContext } from "./AuthContext";
import { closeSession, getSession, openSession, subscribeToSession } from "./session";
import { getApiClient } from "../api/clients";
import { requestToken } from "../api/auth";

/**
 * Marge appliquée avant l'échéance du jeton.
 *
 * Fermer la session pile à l'échéance laisserait passer une requête partie
 * juste avant, qui reviendrait en 401 après coup. Trente secondes suffisent à
 * couvrir le délai d'un appel (15 s au plus, voir `REQUEST_TIMEOUT_MS`).
 */
export const EXPIRY_MARGIN_MS = 30_000;

function messageOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeToSession, getSession, getSession);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (username: string, password: string): Promise<boolean> => {
    setIsSigningIn(true);
    setError(null);
    try {
      const token = await requestToken({ client: getApiClient(), username, password });
      // Un jeton illisible ou déjà échu n'ouvre pas de session : le dire plutôt
      // que de laisser l'utilisateur sur un écran qui échouera en 401.
      if (openSession(token.access_token) === null) {
        setError("Le jeton délivré par l'API est illisible ou déjà expiré.");
        return false;
      }
      return true;
    } catch (caught) {
      setError(messageOf(caught));
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setError(null);
    closeSession();
  }, []);

  // Fermeture automatique à l'échéance du jeton. Le minuteur est reposé à
  // chaque changement de session et retiré au démontage : une session fermée
  // à la main ne doit pas laisser un minuteur en vie.
  const expiresAtMs = session?.claims.expiresAtMs ?? null;
  useEffect(() => {
    if (expiresAtMs === null) {
      return;
    }
    const delay = expiresAtMs - EXPIRY_MARGIN_MS - Date.now();
    // Un jeton dont l'échéance est déjà dans la marge est fermé sans attendre,
    // setTimeout traitant un délai négatif comme un délai nul.
    const timer = setTimeout(closeSession, Math.max(delay, 0));
    return () => {
      clearTimeout(timer);
    };
  }, [expiresAtMs]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isSigningIn,
      error,
      signIn,
      signOut,
    }),
    [session, isSigningIn, error, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
