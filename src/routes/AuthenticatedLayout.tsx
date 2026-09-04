/**
 * Enveloppe commune aux écrans authentifiés (EV-50).
 *
 * Le layout réunit ce que tout écran connecté partage : la garde de session,
 * la navigation principale et le fond de page. Les écrans, eux, ne portent
 * plus que leur contenu.
 *
 * La garde est placée ici et non sur chaque route : ajouter un écran ne doit
 * pas pouvoir se faire en oubliant de le protéger. Le durcissement complet des
 * routes, rôles compris, reste le périmètre d'EV-49.
 */

import { Outlet } from "react-router-dom";
import { AppNavbar } from "../components/AppNavbar";
import { RequireAuth } from "./RequireAuth";

export function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen flex-col bg-ardoise-50">
        <AppNavbar />
        <Outlet />
      </div>
    </RequireAuth>
  );
}
