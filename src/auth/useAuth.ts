/** Accès au contexte d'authentification (EV-48). */

import { useContext } from "react";
import type { AuthContextValue } from "./AuthContext";
import { AuthContext } from "./AuthContext";

/**
 * Rend le contexte d'authentification, ou lève si le provider est absent.
 *
 * Échouer bruyamment est voulu : rendre un écran protégé hors de
 * `AuthProvider` produirait sinon un dashboard qui se croit déconnecté sans
 * qu'on sache pourquoi.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth doit être appelé dans un AuthProvider.");
  }
  return value;
}
