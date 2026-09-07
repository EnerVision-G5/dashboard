/**
 * Chargement du référentiel des sites et mémorisation du site sélectionné.
 *
 * **Le site choisi vit dans l'adresse**, sous `?site=`. Ce n'est pas un détail
 * d'implémentation : le dashboard a maintenant deux écrans — supervision et
 * diagnostic — et passer de l'un à l'autre ne doit pas perdre le site qu'on
 * examine. L'URL est la seule source de vérité qui traverse une navigation,
 * survit à un rechargement, et se partage par copier-coller à un collègue.
 *
 * Un contexte React aurait répondu au premier besoin seulement, au prix d'un
 * état partagé de plus.
 *
 * La requête est annulée si le composant est démonté avant la réponse, pour ne
 * pas écrire dans un état disparu.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Site } from "../api/sites";
import { fetchSites, pickInitialSite } from "../api/sites";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/** État exposé par `useSites`. */
export interface SitesState {
  sites: Site[];
  selectedSite: Site | null;
  selectSite: (siteId: string) => void;
  /** Relit le référentiel, après une synchronisation par exemple. */
  reload: () => void;
  isLoading: boolean;
  error: string | null;
}

/** Nom du paramètre d'adresse portant le site examiné. */
export const SITE_PARAM = "site";

export function useSites(): SitesState {
  const [sites, setSites] = useState<Site[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSiteId = searchParams.get(SITE_PARAM);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Compteur d'actualisation : l'incrémenter relance l'effet, ce qui est la
  // seule façon de relire le référentiel sans dupliquer la logique de
  // chargement hors de l'effet.
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const loaded = await fetchSites(getApiClient(), controller.signal);
        if (!active) {
          return;
        }
        setSites(loaded);
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        setSites([]);
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [refreshCount]);

  useEffect(() => {
    if (sites.length === 0) {
      return;
    }
    if (selectedSiteId !== null && sites.some((site) => site.site_id === selectedSiteId)) {
      return;
    }
    // L'adresse ne nomme aucun site, ou en nomme un qui a disparu du
    // référentiel : on retombe sur le premier site actif. Sans cette garde,
    // une synchronisation ramènerait l'écran sur ce premier site au milieu
    // d'une consultation.
    const initial = pickInitialSite(sites)?.site_id ?? null;
    setSearchParams(
      (params) => {
        if (initial === null) {
          params.delete(SITE_PARAM);
        } else {
          params.set(SITE_PARAM, initial);
        }
        return params;
      },
      // La présélection n'est pas une navigation : l'utilisateur n'a rien
      // demandé, et le bouton retour ne doit pas l'y ramener.
      { replace: true },
    );
  }, [sites, selectedSiteId, setSearchParams]);

  const selectSite = useCallback(
    (siteId: string) => {
      // Un choix explicite, lui, entre dans l'historique : le bouton retour
      // ramène au site précédemment consulté.
      setSearchParams((params) => {
        params.set(SITE_PARAM, siteId);
        return params;
      });
    },
    [setSearchParams],
  );

  const reload = useCallback(() => {
    setRefreshCount((count) => count + 1);
  }, []);

  return {
    sites,
    selectedSite: sites.find((site) => site.site_id === selectedSiteId) ?? null,
    selectSite,
    reload,
    isLoading,
    error,
  };
}
