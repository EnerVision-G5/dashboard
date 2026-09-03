/**
 * Dernière mesure connue d'un site, rafraîchie en continu (panneau temps réel).
 *
 * Mêmes garde-fous que `useSiteSeries`, pour les mêmes raisons : l'état porte
 * l'identifiant du site auquel il appartient et n'est exposé que si cet
 * identifiant est encore celui demandé, et la requête en cours est annulée à
 * chaque changement de site. Une mesure ne peut donc jamais s'afficher sous le
 * nom d'un autre site.
 */

import { useEffect, useState } from "react";
import type { EnergyReading } from "../api/readings";
import { fetchLatestReading } from "../api/readings";
import { getApiClient } from "../api/clients";
import { isCancellation } from "../api/http";

/**
 * Période de rafraîchissement du panneau temps réel.
 *
 * La collecte écrit une mesure par minute : interroger plus souvent
 * relirait la même ligne. Trente secondes gardent l'écran vivant sans
 * marteler l'API, et bornent à une demi-minute le retard affiché.
 */
export const REFRESH_INTERVAL_MS = 30_000;

/** État exposé par `useLatestReading`. */
export interface LatestReadingState {
  /** Dernière mesure du site demandé, `null` tant qu'aucune n'est arrivée. */
  reading: EnergyReading | null;
  /** Vrai tant que la première mesure du site demandé n'est pas arrivée. */
  isLoading: boolean;
  /** Erreur du flux, `null` s'il a abouti. */
  error: string | null;
}

interface LoadedState {
  siteId: string | null;
  reading: EnergyReading | null;
  error: string | null;
}

const EMPTY: LoadedState = { siteId: null, reading: null, error: null };

export function useLatestReading(siteId: string | null): LatestReadingState {
  const [loaded, setLoaded] = useState<LoadedState>(EMPTY);

  useEffect(() => {
    // Aucun site demandé : rien à charger, et rien à remettre à zéro non plus.
    // Le garde `isCurrent` ci-dessous n'expose déjà plus l'état précédent.
    if (siteId === null) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function load(currentSiteId: string): Promise<void> {
      try {
        const reading = await fetchLatestReading(
          getApiClient(),
          currentSiteId,
          controller.signal,
        );
        if (active) {
          setLoaded({ siteId: currentSiteId, reading, error: null });
        }
      } catch (caught) {
        if (!active || isCancellation(caught)) {
          return;
        }
        // La mesure précédente est effacée avec l'erreur : garder à l'écran
        // une valeur dont on ne sait plus si elle est encore d'actualité
        // serait pire que de dire qu'on ne sait pas.
        setLoaded({
          siteId: currentSiteId,
          reading: null,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      }
    }

    void load(siteId);
    const timer = setInterval(() => {
      void load(siteId);
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
      controller.abort();
    };
  }, [siteId]);

  const isCurrent = siteId !== null && loaded.siteId === siteId;

  return {
    reading: isCurrent ? loaded.reading : null,
    error: isCurrent ? loaded.error : null,
    isLoading: siteId !== null && !isCurrent,
  };
}
