/**
 * Chargement du référentiel des sites et mémorisation du site sélectionné.
 *
 * La requête est annulée si le composant est démonté avant la réponse, pour ne
 * pas écrire dans un état disparu.
 */

import { useCallback, useEffect, useState } from "react";
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

export function useSites(): SitesState {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
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
        // Le choix de l'utilisateur survit à un rechargement : il n'est
        // remplacé que si le site sélectionné a disparu du référentiel. Sans
        // cette garde, une synchronisation ramènerait l'écran sur le premier
        // site actif au milieu d'une consultation.
        setSelectedSiteId((current) =>
          current !== null && loaded.some((site) => site.site_id === current)
            ? current
            : (pickInitialSite(loaded)?.site_id ?? null),
        );
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        setSites([]);
        setSelectedSiteId(null);
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

  const selectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

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
