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
  isLoading: boolean;
  error: string | null;
}

export function useSites(): SitesState {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // Valeur initiale uniquement : les rendus suivants ne repassent pas
        // ici, le choix de l'utilisateur ne peut donc pas être écrasé.
        setSelectedSiteId(pickInitialSite(loaded)?.site_id ?? null);
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
  }, []);

  const selectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

  return {
    sites,
    selectedSite: sites.find((site) => site.site_id === selectedSiteId) ?? null,
    selectSite,
    isLoading,
    error,
  };
}
