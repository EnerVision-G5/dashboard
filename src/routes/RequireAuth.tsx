/**
 * Garde de route : n'affiche son contenu qu'à un utilisateur authentifié.
 *
 * Cette garde est côté navigateur, elle ne protège donc rien par elle-même :
 * c'est l'API qui refuse en 401 une requête sans jeton valide, et elle seule
 * fait autorité. Le rôle de ce composant est d'éviter d'afficher un écran qui
 * ne peut que se remplir d'erreurs, et de ramener l'utilisateur au formulaire.
 *
 * Le durcissement complet des routes est le périmètre d'EV-49.
 */

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { LOGIN_PATH } from "./paths";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // `replace` : la page refusée ne doit pas rester dans l'historique, sans
    // quoi le bouton retour y ramènerait aussitôt. L'adresse demandée voyage
    // dans l'état pour qu'on y revienne une fois connecté.
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }
  return children;
}
