# dashboard

[![ci](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/EnerVision-G5/dashboard/actions/workflows/ci.yml)

Dashboard web EnerVision (React + Vite + Recharts, ADR-008).

L'écran livré par **EV-16** permet à un client pilote de choisir un site et de
lire, sur un même graphique, sa **consommation réelle** des 24 dernières heures
et sa **prédiction** sur les 24 heures suivantes.

**EV-48** y ajoute l'authentification : une page de connexion garde l'entrée, le
jeton obtenu signe tous les appels, et le dashboard est mis en page d'après la
maquette « Smart Energy Optimiser » — consommation temps réel, recommandations,
indicateurs. **EV-50** réunit les écrans authentifiés derrière une barre de
navigation commune, voir [Navigation](#navigation).

**EV-18** y ajoute un bandeau qui qualifie les données affichées — fraîcheur de
l'ingestion, part de mesures dégradées, état des capteurs — pour qu'aucune
décision ne soit prise sur des données incomplètes sans le savoir. Voir
[Bandeau de fraîcheur et de qualité des données](#bandeau-de-fraîcheur-et-de-qualité-des-données).

Le dashboard ne parle qu'à des services EnerVision : l'API métier pour les
sites et les mesures, le service d'inférence pour la prédiction. **Il n'appelle
jamais l'API Mock IoT directement.**

## Design system

L'interface repose sur un design system minimal (**EV-47**), dont la note de
conception — validée avant écriture du code — vit dans le repo `enervision`
sous `Architecture/EnerVision-Design-System.docx`.

Son principe tient en une phrase : *un écran de supervision affiche trois
natures de valeur — ce qui a été **mesuré**, ce qui a été **calculé**, et ce
qu'on **ignore** — et le système a une obligation, qu'on ne puisse jamais les
confondre.*

| | Emplacement |
| --- | --- |
| Jetons (couleur, typographie, rayon, élévation) | `src/index.css`, dans `@theme` |
| Composants (`Button`, `Card`, `Field`, `MetricTile`, `Alert`, les quatre états) | `src/ui/` |
| Page de démonstration, **développement seulement** | [`/design-system`](http://localhost:5173/design-system) |
| Mode d'emploi complet | [`docs/design-system.md`](docs/design-system.md) |

La page de démonstration n'existe pas dans le bundle de production — son
import est enfermé dans `import.meta.env.DEV`, que Vite remplace par une
constante au build ; un test le vérifie en forçant `DEV` à `false`.

![Le dashboard sur trois largeurs](docs/images/app-dashboard-bureau.png)

## Prérequis

- **Node 24** (version utilisée par la CI ; `jsdom` exige au minimum Node 22.22
  ou 24.15).
- Une API métier joignable, et un service d'inférence joignable si l'on veut la
  prédiction réelle.

## Installation et commandes

```bash
npm ci
```

| Commande            | Rôle                                               |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Serveur de développement sur http://localhost:5173 |
| `npm test`          | Tests Vitest + Testing Library (une seule passe)   |
| `npm run lint`      | ESLint                                             |
| `npm run build`     | Vérification TypeScript puis build de production   |
| `npm run gen:types` | Régénère `src/types` depuis les contrats OpenAPI   |

La CI (`.github/workflows/ci.yml`) enchaîne `npm ci`, `npm run lint`,
`npm test` et `npm run build` à chaque push et sur chaque pull request. Le job
de tests appelle `npm test` sans `--if-present` : une suite absente fait
désormais échouer la CI au lieu de la laisser verte à tort.

## Configuration

Copier `.env.example` en `.env` (ou `.env.local`, ignoré par git) et adapter.

| Variable                        | Rôle                                                     | Défaut      |
| ------------------------------- | -------------------------------------------------------- | ----------- |
| `VITE_API_BASE_URL`             | Base de l'API métier (sites, mesures)                    | **requise** |
| `VITE_PREDICT_BASE_URL`         | Base du service d'inférence                              | **requise** |
| `VITE_PREDICTION_SOURCE`        | `api` (service réel) ou `fixture` (JSON de démonstration) | `api`       |
| `VITE_DEV_PROXY_API_TARGET`     | Cible du proxy de dev pour `/proxy/api` (facultatif)     | —           |
| `VITE_DEV_PROXY_PREDICT_TARGET` | Cible du proxy de dev pour `/proxy/predict` (facultatif) | —           |

Aucune de ces valeurs n'est un secret : ce sont des adresses de service. Le
jeton, lui, n'est jamais configuré — il est obtenu à la connexion et vit en
mémoire, voir [Authentification](#authentification).

### En image : la configuration est lue au démarrage

Vite fige les variables `VITE_*` dans le bundle **au build**. L'image est
pourtant construite une seule fois par commit, épinglée par SHA, puis déployée
telle quelle sur des environnements dont les domaines diffèrent : les figer au
build imposerait une image par environnement.

Le conteneur lit donc sa configuration à son démarrage, comme le font déjà
`api` et `predict` :

| Variable du conteneur | Remplace |
| --- | --- |
| `API_BASE_URL` | `VITE_API_BASE_URL` |
| `PREDICTION_SOURCE` | `VITE_PREDICTION_SOURCE` |
| `CSP_CONNECT_SRC` | — (origines de la CSP, voir [Sécurité](#sécurité)) |

```
config.js.template ──envsubst au démarrage──> /etc/nginx/config.js
                                                      │
index.html : <script src="/config.js">  ◄─────────────┘  servi par Nginx
src/config/env.ts : window.__ENERVISION_CONFIG__ ?? import.meta.env
```

L'ordre compte : en image la configuration injectée l'emporte ; en
développement elle n'existe pas et le `.env` reprend la main sans qu'on ait à
le dire. Une adresse absente des deux côtés donne une erreur de configuration
nommant la variable, jamais un appel vers un hôte deviné.

`/config.js` est servi en `no-cache` et **ne doit jamais porter de secret** :
il part en clair à quiconque ouvre la page.

Une base absente n'est pas remplacée par une valeur devinée : l'écran affiche
une erreur de configuration nommant la variable manquante.

### Deux bases, et après ?

Le contrat gelé publie encore deux spécifications distinctes
(`openapi-api.json` et `openapi-predict.json`), donc deux services. La cible
d'architecture V2 est un dashboard ne parlant qu'à l'API métier, laquelle ferait
proxy vers Predict. Le code est prêt pour ce basculement : seules les fonctions
de `src/config/env.ts` connaissent les bases, les composants ne voient que
`fetchPrediction`. Le jour venu, il suffira de faire pointer
`VITE_PREDICT_BASE_URL` sur l'API métier.

### Proxy de développement et CORS

L'API métier publie ses en-têtes `Access-Control-*` sur les seules origines
listées dans sa variable `CORS_ALLOWED_ORIGINS`. Tant qu'elle n'y connaît pas
`http://localhost:5173`, sa réponse est bloquée par le navigateur. Deux voies
pour une recette locale — soit renseigner cette variable côté API, soit faire
passer les appels par l'origine de Vite, ce qui évite complètement le
cross-origin :

```bash
VITE_API_BASE_URL=/proxy/api
VITE_PREDICT_BASE_URL=/proxy/predict
VITE_DEV_PROXY_API_TARGET=http://localhost:8080
VITE_DEV_PROXY_PREDICT_TARGET=http://localhost:8001
```

Ce proxy ne concerne que `npm run dev` : l'image de production est servie par
Nginx, qui ne proxifie rien. En production, les appels sont donc bel et bien
cross-origin, et les deux côtés doivent se déclarer mutuellement —
`CSP_CONNECT_SRC` côté dashboard, `CORS_ALLOWED_ORIGINS` côté API, voir
[Sécurité](#sécurité).

## Authentification

Flux OAuth2 mot de passe (ADR-009). L'écran de connexion poste les identifiants
en `application/x-www-form-urlencoded` sur `POST /api/v1/auth/token`, et le
jeton obtenu signe ensuite chaque appel en `Authorization: Bearer`.

```
POST /api/v1/auth/token          → { access_token, token_type, expires_in }
                                 ↓
             jeton en mémoire (src/auth/session.ts)
                                 ↓
    intercepteur Axios (src/api/clients.ts) → Authorization: Bearer …
```

Comptes de développement : `dev.reader` / `changeme-dev`, issus du seed
`enervision-db/dev-seed/dev_users.py` du repo **infra**, à appliquer
explicitement. En local, `AUTH_ENABLED=false` côté API permet aussi de
travailler sans jeton — mais l'écran de connexion reste alors affiché, le
dashboard n'ayant aucun moyen de savoir que l'API est en mode anonyme.

### Où vit le jeton

Dans **`sessionStorage`**, sous la clé `enervision.auth.token`, et nulle part
ailleurs. Jamais dans `localStorage`, jamais dans un cookie.

| | Refresh | Nouvel onglet | Onglet fermé |
| --- | --- | --- | --- |
| Session conservée | oui | non | non |

Le choix est un compromis, documenté en détail dans
[`docs/EV-48-securite.md`](docs/EV-48-securite.md) :

- un **cookie `httpOnly`** serait hors d'atteinte de tout JavaScript, donc le
  meilleur choix sur le fond. Il est écarté faute de moyen : l'API délivre le
  jeton dans un corps JSON et ne pose aucun cookie. L'y amener demande une PR
  de contrat ;
- **`localStorage`** survivrait à la fermeture de l'onglet et serait partagé
  entre onglets — précisément ce que l'OWASP déconseille pour un jeton ;
- **`sessionStorage`** garde la session au rafraîchissement, meurt avec
  l'onglet et n'est pas partagé.

> Le guide d'intégration front demandait le jeton « en mémoire, pas en
> localStorage ». `sessionStorage` s'en écarte volontairement, pour l'usage, et
> la contrepartie est la **CSP** posée dans `nginx.conf` : c'est elle qui
> empêche un script injecté d'être chargé, donc de lire le stockage. Le guide
> est à amender en conséquence.

Un jeton stocké n'est jamais accordé sur parole : au chargement, il repasse par
le même contrôle que celui délivré par l'API, échéance comprise. Un jeton échu
ou trafiqué est effacé du stockage plutôt que porté sur des appels qui
reviendraient tous en 401. Ce contrôle reste du confort — la signature est
vérifiée par l'API, seule autorité.

### Fin de session

Trois chemins la ferment, tous vers l'écran de connexion :

- **déconnexion explicite**, par le bouton de l'en-tête ;
- **échéance du jeton**, lue dans sa revendication `exp`, 30 secondes avant
  l'heure pour qu'une requête déjà partie ne revienne pas en 401 ;
- **401 renvoyé par l'API**, quelle que soit la route : l'intercepteur de
  réponse ferme la session sans qu'aucun écran ait à le décider.

**Pas de rafraîchissement silencieux.** Le contrat gelé 1.0.0 ne publie que le
flux mot de passe, sans `refresh_token` : redemander un jeton exigerait de garder
le mot de passe en mémoire toute la session, ce qui coûte plus cher que la
reconnexion évitée. Le jour où le contrat publiera un flux de rafraîchissement,
seul le minuteur de `src/auth/AuthProvider.tsx` changera.

### Ce que la garde de route protège

`RequireAuth` empêche d'**afficher** un écran qui ne pourrait que se remplir
d'erreurs. Elle ne protège aucune donnée : c'est l'API qui refuse en 401 une
requête sans jeton valide, et elle seule fait autorité. Le durcissement complet
des routes est le périmètre d'**EV-49**.

Le rôle (`reader` ou `writer`) est lu dans le jeton, le contrat ne publiant
aucun endpoint de profil. La signature n'est pas vérifiée côté navigateur et ne
peut pas l'être : la clé HS256 est le secret de l'API. Ce décodage sert à
l'affichage et à l'échéance, jamais à autoriser quoi que ce soit.

## Navigation

**EV-50** pose une barre de navigation commune à tous les écrans authentifiés.
Elle porte l'identité du produit, les destinations, l'utilisateur connecté et la
déconnexion — un seul endroit, pour qu'un second écran n'apporte pas une
deuxième barre.

| Destination | Adresse | État |
| --- | --- | --- |
| Dashboard | `/` | Servie |
| Configuration | `/config` | Coquille, contenu attendu par EV-55 |

La page affichée est signalée de trois façons : par le poids du texte, par un
fond, et par `aria-current="page"` — le seul repère qu'un lecteur d'écran
puisse annoncer. La couleur ne porte jamais seule cette information, le design
system l'interdit.

Le lien vers le dashboard exige une correspondance **exacte** (`end`) : servi
sur `/`, préfixe de toute autre adresse, il resterait sinon actif sur la page
de configuration.

La garde de session et la barre sont portées par une route parente,
`AuthenticatedLayout` : un écran ajouté sous elle hérite des deux sans rien
déclarer, et ne peut donc pas être oublié hors authentification. Le
durcissement complet, rôles compris, reste le périmètre d'**EV-49**.

La page `/config` est servie dès maintenant, mais **n'affiche aucun
paramètre**. Un lien de navigation qui retomberait sur la règle `*` ramènerait
au dashboard sans rien dire, ce qui se lit comme une panne ; à l'inverse, un
formulaire posé là aujourd'hui promettrait une persistance que le contrat gelé
1.1.0 ne publie pas. L'écran dit donc ce qu'il en est et renvoie à **EV-55**.

## Écran de supervision

La mise en page suit la maquette « Smart Energy Optimiser » : sous la barre de
navigation, un en-tête portant le sélecteur de site et — à droite — la puissance
souscrite et la localisation du site choisi, puis trois zones.

| Zone | Source | État |
| --- | --- | --- |
| Fraîcheur et qualité | `GET /indicators` et `GET /sites/{id}/sensors`, rafraîchis toutes les 60 s | Servie |
| Consommation temps réel | `GET /sites/{id}/readings/latest`, rafraîchi toutes les 30 s | Servie |
| Recommandations | `GET /sites/{id}/recommendations`, servie mais pas encore branchée | Vide, voir ci-dessous |
| Indicateurs | graphique consommation / prédiction d'EV-16 | Servi |

### Bandeau de fraîcheur et de qualité des données

**EV-18** pose au-dessus des trois zones un bandeau qui qualifie ce qu'elles
affichent. Il répond à une question simple : *puis-je décider sur la base de ce
que je vois ?*

| Source | Portée |
| --- | --- |
| `GET /indicators?window_hours=24` | les sept sites, en une requête |
| `GET /sites/{id}/sensors` | le site affiché seulement |

Le contrat **1.5.0** a rendu ce ticket possible. Il publie non seulement les
indicateurs, mais **le seuil qui qualifie chacun d'eux** —
`stale_threshold_seconds` pour la fraîcheur, `threshold` pour la part dégradée
— ainsi que les verdicts `is_stale`, `exceeds_threshold` et la synthèse
`overall` des capteurs. Le dashboard les relit ; **il ne choisit aucun seuil**,
sans quoi un seuil révisé côté exploitation devrait être suivi à deux endroits.

![Les trois niveaux du bandeau, et le cas des deux flux tombés](docs/images/app-bandeau-qualite.png)

Trois niveaux, dans le vocabulaire du contrat :

| Niveau | Ce qui le déclenche | Traitement |
| --- | --- | --- |
| `ok` | aucun constat | ligne sobre, sans rôle vivant : rien à annoncer |
| `degraded` | retard d'ingestion, part dégradée au-delà du seuil, fenêtre non qualifiée, panne de capteur | famille « estimation », `role="status"` |
| `critical` | site sans aucune mesure, perte réseau | famille « alerte », `role="alert"` |

Quatre décisions valent d'être expliquées.

**Le bandeau est affiché en permanence**, pas seulement en cas d'incident. Un
bandeau qui n'apparaît qu'en cas de problème est indiscernable d'un bandeau en
panne : rien à l'écran ne dirait alors si les données sont saines ou si la
vérification a échoué. L'état sain porte donc l'heure du dernier calcul servi
par l'API.

**Un site muet n'est pas un site en retard.** Le contrat les distingue par
`last_measure_at`, et le second est moins grave que le premier : un site qui ne
mesure plus rien est `critical`, un site en retard est `degraded`.

**Une fenêtre non qualifiée n'est pas une fenêtre saine.** `data_quality` vaut
`good` par défaut : une fenêtre que l'ETL n'a pas encore traitée affiche donc
0 % de dégradation sans rien valoir. `qualified_ratio` le dit, et le bandeau le
signale plutôt que de présenter le site comme propre — c'est précisément ce que
le ticket cherche à empêcher.

**Les deux flux échouent indépendamment.** Des capteurs indisponibles
n'effacent pas une fraîcheur correctement lue, et le flux manquant est nommé.
Quand les deux tombent, le bandeau annonce son ignorance : il ne dit jamais que
tout va bien faute d'avoir pu vérifier.

Le bandeau est rafraîchi toutes les 60 secondes. Ce n'est pas un ornement : la
fraîcheur se dégrade toute seule, et un bandeau figé finirait par affirmer que
les données sont à jour dix minutes après la chute de l'ingestion.

**Limite connue :** l'état des capteurs n'est lu que pour le site affiché, le
contrat ne publiant pas de route capteurs pour le parc. Sept requêtes en
parallèle à chaque rafraîchissement coûteraient plus que ce que le bandeau en
tirerait ; le besoin est remonté plutôt que contourné. La fraîcheur et la
qualité, elles, couvrent bien les sept sites.

**Consommation temps réel** affiche la puissance instantanée, puis la tension,
l'intensité, la température et l'humidité — toutes issues de la même
`EnergyReadingOut`. Une valeur `null` y est affichée comme absente (`—`), jamais
comme un zéro, et la valeur imputée par l'ETL n'est jamais substituée au relevé :
elle est mentionnée pour ce qu'elle est. Une mesure vieille de plus de deux
minutes signale un retard d'ingestion. Ce seuil-là vient du guide
d'intégration et reste écrit dans `src/api/readings.ts` ; le bandeau d'EV-18,
lui, tient le sien de l'API. Les aligner — c'est-à-dire faire lire à ce panneau
le `stale_threshold_seconds` du contrat — relève d'**EV-52**, qui reprend le
panneau temps réel.

**Recommandations** tient sa place dans la mise en page sans rien afficher, et
c'est désormais un retard et non une impossibilité : le contrat **1.5.0**
publie `GET /sites/{id}/recommendations`, servi par l'API. Le brancher relève
d'**EV-54**. La zone reste donc vide en attendant, plutôt que remplie de
conseils inventés : sur une facture d'électricité, ils seraient lus comme de
vrais conseils.

## Flux de données

```
POST /api/v1/auth/token                 → jeton, signe tous les appels suivants
GET  /api/v1/sites                      → référentiel, alimente le sélecteur
GET  /api/v1/sites/{id}/readings/latest → dernière mesure, panneau temps réel
GET  /api/v1/sites/{id}/readings        → mesures des 24 dernières heures
POST /api/v1/predict                    → prévision sur 24 heures
                                        ↓
                    fusion par horodatage (src/lib/series.ts)
                                        ↓
                         graphique Recharts, deux courbes
```

Au chargement, le premier site dont le `status` vaut `active` est présélectionné
— valeur initiale seulement, jamais réimposée ensuite. Changer de site relance
les deux flux ; la requête précédente est annulée (`AbortController`), et les
données ne sont affichées que si elles proviennent bien du site demandé.

### Pagination des mesures

`GET /readings` plafonne une page à 1 000 éléments. À une mesure par minute,
24 heures en produisent 1 440 : le client suit donc `meta.total` et incrémente
`offset` jusqu'à couvrir la fenêtre. Une page vide interrompt la boucle, et un
plafond de 20 pages la borne si le serveur annonçait un total incohérent.

### Valeurs nulles et valeurs imputées

L'API conserve les valeurs brutes de la source. Le dashboard fait de même :

- `consumption_kw` à `null` reste un **trou** dans la courbe
  (`connectNulls={false}`) ; le nombre de mesures absentes est affiché sous le
  graphique ;
- `consumption_kw_imputed` **n'est jamais tracée comme une mesure réelle**. Elle
  est transportée jusqu'au survol, avec sa méthode (`locf`, `interpolation`), et
  présentée explicitement comme reconstituée par l'ETL ;
- `data_quality` est repris tel quel dans l'infobulle ;
- aucun point n'est fabriqué pour relier la dernière mesure à la première
  prédiction : les deux courbes ne se rejoignent que si le contrat renvoie
  réellement le même horodatage ;
- les bornes de confiance nulles sont ignorées, jamais inventées.

### États d'erreur

Les deux flux échouent indépendamment : une prédiction indisponible n'efface pas
des mesures correctement reçues. Chaque code a un message dédié — 401, 403, 404,
422, 501, 503 et service injoignable — et le `detail` du contrat est repris
quand il apporte une information utile. Toutes les erreurs des deux contrats
ont la même forme, un objet à un seul champ `detail`.

**Aucune erreur ne déclenche le mode démonstration.** En mode `api`, une panne
est affichée comme une panne.

## Mode JSON de démonstration

`POST /api/v1/predict` est implémenté depuis
[predict#26](https://github.com/EnerVision-G5/predict/pull/26), mais répond
**503** tant qu'aucun modèle n'est publié au registre MLflow. Pour démontrer
l'écran malgré cela :

```bash
VITE_PREDICTION_SOURCE=fixture
```

Dans ce mode :

- la prédiction vient de `src/fixtures/prediction-demo.json`, un JSON versionné,
  déterministe et conforme à `PredictionOut` (24 points horaires, valeurs fixes,
  validé par TypeScript via `satisfies`) ;
- **les mesures restent réelles** : seule la courbe de prédiction est simulée ;
- un bandeau **« Données de démonstration »** est affiché en haut de l'écran et
  nomme la série concernée ;
- `model_version` vaut `demo-fixture-1.0.0`, ce qui identifie sans ambiguïté une
  donnée simulée ;
- aucun appel réseau n'est émis vers le service d'inférence.

Seul un décalage en jours entiers est appliqué pour amener la série en face de
la fenêtre affichée, ce qui préserve son profil jour/nuit. Les valeurs, elles,
ne sont jamais modifiées.

**Pour revenir au service réel :** remettre `VITE_PREDICTION_SOURCE=api` (ou
supprimer la ligne) et relancer `npm run dev`. La suppression définitive du mode
se limite à `src/fixtures/`, à `getPredictionSource` dans `src/config/env.ts` et
au composant `DemoDataBadge`.

## Sécurité

La revue complète est dans [`docs/EV-48-securite.md`](docs/EV-48-securite.md) :
cycle de vie du jeton, surface XSS, en-têtes servis par Nginx, fuite
d'information, dépendances, et cinq recommandations.

Deux points à retenir avant de déployer :

- la **CSP** restreint `connect-src` aux origines déclarées. Traefik route le
  dashboard et l'API sur **deux hôtes distincts** (`app.` et `api.`), donc deux
  origines : sans configuration, le navigateur bloque tous les appels. Les
  origines autorisées se posent au déploiement dans la variable
  d'environnement **`CSP_CONNECT_SRC`** du conteneur, voir
  [Origines autorisées](#origines-autorisées-csp_connect_src) ;
- les variables `VITE_` sont remplacées par leur valeur **à la compilation** et
  se lisent en clair dans le bundle livré. Ce sont des adresses de service, et
  aucune ne doit jamais porter de secret.

### Origines autorisées (`CSP_CONNECT_SRC`)

La CSP est produite au **démarrage du conteneur** à partir de
`security-headers.conf.template`, et non figée au build : l'image est
construite une fois par commit puis déployée telle quelle sur des
environnements dont les domaines diffèrent.

```bash
docker run -e CSP_CONNECT_SRC="https://api.enervision.com https://predict.enervision.com" ...
```

| Valeur | `connect-src` produit | Effet |
| --- | --- | --- |
| non renseignée | `'self'` | Aucun appel cross-origin. **Défaut, qui échoue en se fermant.** |
| `https://api.example.com` | `'self' https://api.example.com` | Cette seule origine est joignable |

Les origines exactes, séparées par des espaces, schéma compris, **sans chemin
ni joker**. Un `*` rendrait l'en-tête inutile.

Deux réglages doivent concorder de part et d'autre, sinon le navigateur bloque
malgré une configuration correcte d'un seul côté :

| Côté | Réglage | Rôle |
| --- | --- | --- |
| dashboard | `CSP_CONNECT_SRC` | Autorise le navigateur à **émettre** l'appel |
| api | `CORS_ALLOWED_ORIGINS` | Autorise le navigateur à **lire** la réponse |

## Recette manuelle

La procédure détaillée, avec les commandes exactes et ce qui a été vérifié, est
dans [`docs/EV-16-recette.md`](docs/EV-16-recette.md) pour l'écran de
consommation, et dans [`docs/EV-48-recette.md`](docs/EV-48-recette.md) pour
l'authentification et la mise en page.

La recette d'EV-48 signale un **point bloquant** : le seed de comptes de
développement du repo infra écrit un hachage bcrypt, que l'API — qui ne vérifie
que de l'argon2id — refuse. Les comptes `dev.reader` et `dev.writer` ne peuvent
donc pas se connecter tant qu'infra n'a pas corrigé ; le contournement local est
décrit dans la recette.

## Types dérivés des contrats OpenAPI

Les types de `src/types` sont générés depuis les contrats OpenAPI gelés du repo
`enervision`, dans `docs/contracts`.

**Ne jamais éditer `src/types` à la main, toujours régénérer via
`npm run gen:types` après une évolution de contrat.**

```bash
npm run gen:types
```

- `openapi-api.json` produit `src/types/api.d.ts`. Le contrat **1.5.0** y
  ajoute les indicateurs de confiance, l'état et l'historique des capteurs, les
  recommandations, le registre des modèles, les simulations de pic, et les
  champs `excluded` / `exclusion_reason` sur chaque mesure. Aucun champ n'a
  disparu au passage depuis le 1.1.0, et aucun paramètre n'a changé : le code
  déjà livré n'a pas été touché.

> **Chemin contenant une espace.** `scripts/gen-types.mjs` appelait le
> générateur par `npx` dans un shell, qui ne reçoit pas les arguments échappés :
> un chemin de projet comportant une espace y était coupé au premier blanc, si
> bien que les types atterrissaient silencieusement dans un fichier portant la
> première moitié du chemin — `src/types/api.d.ts` restant inchangé, sans la
> moindre erreur. Le script exécute désormais le fichier du générateur avec le
> Node courant, sans shell.

Le script résout le dossier des contrats à `../docs/contracts`, position du
dashboard monté en submodule dans `enervision`. Si le dashboard est cloné
isolément, pointer `CONTRACTS_DIR` sur une copie du repo `enervision` :

```bash
CONTRACTS_DIR=/chemin/vers/enervision/docs/contracts npm run gen:types
```

Une évolution de contrat passe d'abord par une PR sur `enervision`, décrite dans
`docs/contracts/README.md` de ce repo. Les types sont régénérés et committés une
fois cette PR fusionnée.
