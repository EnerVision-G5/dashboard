/**
 * Table des routes du dashboard (EV-48).
 *
 * Séparée du `BrowserRouter` d'`App` pour que les tests puissent la monter
 * dans un `MemoryRouter` et vérifier la navigation sans toucher à l'historique
 * du navigateur.
 */

import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { SiteDashboardPage } from "../pages/SiteDashboardPage";
import { RequireAuth } from "./RequireAuth";
import { DASHBOARD_PATH, LOGIN_PATH } from "./paths";
import { useAuth } from "../auth/useAuth";

/**
 * Écran de connexion, ou renvoi vers le dashboard si la session est déjà
 * ouverte.
 *
 * C'est ce renvoi qui réalise la redirection attendue après authentification :
 * la page de connexion n'a pas à la déclencher, elle ouvre la session et le
 * routeur en tire les conséquences.
 */
function LoginRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const state = location.state as { from?: string } | null;
    return <Navigate to={state?.from ?? DASHBOARD_PATH} replace />;
  }
  return <LoginPage />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={LOGIN_PATH} element={<LoginRoute />} />
      <Route
        path={DASHBOARD_PATH}
        element={
          <RequireAuth>
            <SiteDashboardPage />
          </RequireAuth>
        }
      />
      {/* Toute autre adresse ramène au dashboard, qui renverra lui-même vers
          la connexion si la session est fermée. */}
      <Route path="*" element={<Navigate to={DASHBOARD_PATH} replace />} />
    </Routes>
  );
}
