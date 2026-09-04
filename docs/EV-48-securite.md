# EV-48 — Revue de sécurité du dashboard

Revue du **03/09/2026**, sur la branche `19-ev-48-authentification-utilisateur`.
Périmètre : le dépôt `dashboard` uniquement. Ce qui relève de l'API ou de
l'infrastructure est signalé comme tel et n'est pas corrigé ici.

Rappel de cadrage : **un front ne protège aucune donnée.** Tout ce qu'il fait
est vérifiable et contournable par qui contrôle le navigateur. La seule
autorité est l'API, qui vérifie la signature du jeton à chaque requête. Ce
document décrit donc surtout ce que le dashboard évite de *rendre facile*.

## 1. Cycle de vie du jeton

| Étape | Comportement | Vérifié |
|---|---|---|
| Obtention | `POST /auth/token`, formulaire `x-www-form-urlencoded` | recette § 2 |
| Portage | En-tête `Authorization: Bearer`, posé par un intercepteur Axios | `clients.test.ts` |
| Stockage | `sessionStorage`, clé `enervision.auth.token` | `session.test.ts` |
| Rafraîchissement de page | Session rouverte, jeton revalidé | recette § 3 |
| Expiration | Minuteur sur le `exp` du jeton, marge de 30 s | `AuthProvider.test.tsx` |
| Déconnexion | Mémoire et stockage vidés | `session.test.ts` |
| 401 sur n'importe quelle route | Session fermée, stockage vidé, retour au formulaire | recette § 2, point 7 |

### Pourquoi `sessionStorage` et pas autre chose

Trois options existaient, aucune parfaite :

| Option | Survit au F5 | Survit à l'onglet fermé | Lisible par un XSS |
|---|---|---|---|
| Cookie `httpOnly` | oui | oui | **non** |
| `sessionStorage` (retenu) | oui | non | oui |
| Mémoire seule | non | non | oui, pendant la vie de l'onglet |
| `localStorage` | oui | oui | oui, et longtemps |

Le cookie `httpOnly` est le seul vraiment hors d'atteinte du JavaScript, donc
le bon choix sur le fond. Il est **écarté faute de moyen** : l'API délivre le
jeton dans un corps JSON (flux OAuth2 mot de passe) et ne pose aucun cookie.
L'y amener demande une évolution de l'API et du contrat gelé — c'est la
recommandation R1 ci-dessous.

`localStorage` est écarté : l'OWASP le déconseille explicitement pour un jeton,
qui y reste moissonnable bien après la fin de la session.

Entre `sessionStorage` et la mémoire seule, l'écart de sécurité réel est
mince — un script injecté peut de toute façon appeler l'API à la place de
l'utilisateur tant que l'onglet est ouvert. `sessionStorage` a été retenu pour
l'usage, et **compensé par la CSP** de la section 3, qui est la vraie parade.

### Un jeton posé à la main n'ouvre rien

Test effectué : un jeton forgé (structure valide, `role: writer`, échéance
lointaine, signature bidon) déposé dans `sessionStorage`, puis rechargement.

Résultat : le front le restaure en mémoire — il ne peut pas vérifier une
signature HS256 sans la clé, qui est le secret de l'API — émet **une** requête,
reçoit **401**, ferme la session, vide le stockage et affiche le formulaire.

C'est le comportement voulu. Le décodage local sert à l'affichage et à
l'échéance ; il n'autorise rien. Un jeton forgé achète exactement une requête
refusée.

## 2. Surface XSS

| Vecteur | État |
|---|---|
| `dangerouslySetInnerHTML`, `innerHTML` | aucun dans `src/` |
| `eval`, `new Function` | aucun |
| `window.location` construit depuis une donnée | aucun ; navigation par `react-router` |
| `target="_blank"` sans `rel` | aucun lien externe |
| Donnée d'API rendue en HTML | non : tout passe par le rendu React, échappé par défaut |

Les valeurs venant de l'API (`site_name`, `location`, `detail` d'erreur,
`null_reasons`) sont rendues comme du texte. Une chaîne contenant du balisage
s'affiche telle quelle, elle n'est pas interprétée.

## 3. En-têtes de sécurité (corrigé dans cette branche)

**Constat initial : `nginx.conf` ne servait aucun en-tête de sécurité.** C'était
le point le plus sérieux de la revue, et il pèse d'autant plus que le jeton est
désormais dans `sessionStorage`.

Ajoutés :

| En-tête | Valeur | Ce qu'il empêche |
|---|---|---|
| `Content-Security-Policy` | voir `nginx.conf` | Le chargement d'un script injecté, donc le vol du jeton |
| `X-Content-Type-Options` | `nosniff` | Qu'un fichier servi en `text/plain` soit exécuté comme du script |
| `X-Frame-Options` | `DENY` | Le clickjacking (double emploi voulu avec `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | La fuite d'URL complètes vers un tiers |
| `Permissions-Policy` | tout à `()` | L'accès aux interfaces caméra, micro, géolocalisation… |

`script-src 'self'` est posé **sans exception** : le bundle Vite ne contient
aucun script inline, vérifié sur `dist/index.html`. `style-src` garde
`'unsafe-inline'`, concession assumée, React et Recharts posant des attributs
`style` sur les éléments.

Vérifié en servant le build de production derrière cette configuration, API sur
la même origine : le dashboard complet, graphique Recharts compris, s'affiche
**sans une seule violation** en console.

> **Corrigé depuis.** Ce document supposait le dashboard et l'API sur la même
> origine derrière Traefik. C'est faux : le rôle Ansible `applications` les
> route sur deux hôtes distincts (`Host(app.…)` et `Host(api.…)`), donc deux
> origines, et `connect-src 'self'` bloquait en réalité tous les appels en
> production. Les origines autorisées se déclarent désormais au déploiement
> dans la variable d'environnement `CSP_CONNECT_SRC`, substituée dans la CSP au
> démarrage du conteneur. Voir le README, section Sécurité.

## 4. Fuite d'information

| Point | État |
|---|---|
| Jeton ou mot de passe dans un log | aucun `console.*` dans `src/` |
| Jeton dans une URL ou une query string | non, uniquement l'en-tête |
| Mot de passe conservé après connexion | non, effacé de l'état React |
| Mot de passe dans le store de session | jamais transmis au store |
| Énumération de comptes | non : compte inconnu et mot de passe faux donnent le même message |
| Message d'erreur exposant l'interne | non : le `detail` de l'API est repris, sans trace d'exécution |

Le message unique sur identifiants invalides reprend délibérément le choix de
l'API, qui répond la même chose dans les deux cas et hache même pour un compte
inexistant afin que le temps de réponse ne trahisse rien.

**Variables `VITE_` : à ne jamais utiliser pour un secret.** Vite les remplace
par leur valeur **à la compilation** : elles se lisent en clair dans le bundle
livré. Les quatre variables du dashboard sont des adresses de service, ce qui
est conforme — mais y placer une clé reviendrait à la publier.

## 5. Dépendances

```
npm audit  →  0 vulnérabilité (info 0, low 0, moderate 0, high 0, critical 0)
```

`npm ci` sur un `package-lock.json` épinglé, conformément à la note de cadrage.
Le scan Grype bloquant reste à câbler en CI (EV-31).

## 6. Ce qui n'est pas couvert ici

- **La signature du jeton**, vérifiée par l'API seule. Le front ne peut pas et
  ne doit pas la vérifier : la clé HS256 est le secret de l'API.
- **HTTPS et HSTS**, du ressort de Traefik (repo infra), pas du conteneur front.
- **Le durcissement des routes**, périmètre d'**EV-49**.
- **Le rôle `writer`**, aucun endpoint d'écriture n'existant au contrat gelé.

## 7. Recommandations

| # | Recommandation | Pour qui | Priorité |
|---|---|---|---|
| R1 | Délivrer le jeton en cookie `httpOnly` + `Secure` + `SameSite=Strict` plutôt qu'en corps JSON. C'est la seule façon de le mettre hors d'atteinte du JavaScript, et cela rendrait la question du stockage sans objet. Demande une PR de contrat. | api + contrat | haute |
| R2 | Publier un flux de rafraîchissement (`refresh_token`). Sans lui, aucune session longue n'est possible sans garder le mot de passe en mémoire, ce que le dashboard refuse de faire. | api + contrat | moyenne |
| R3 | Renseigner `CSP_CONNECT_SRC` (dashboard) et `CORS_ALLOWED_ORIGINS` (api) au déploiement : les deux doivent concorder, sinon le navigateur bloque. | infra + DevOps | haute |
| R4 | Terminer HSTS et la redirection HTTPS côté Traefik. | infra | moyenne |
| R5 | Câbler Grype et la quality gate SonarQube en CI (EV-31). | DevOps | moyenne |

## 8. Deux écarts api ↔ infra, hors périmètre front

Rencontrés en recette, sans conséquence sur la sécurité du front, mais
bloquants pour d'autres tickets — détaillés dans
[`EV-48-recette.md`](EV-48-recette.md) :

1. le seed de comptes de développement d'infra écrit du **bcrypt**, l'API ne
   vérifie que de l'**argon2id** : les comptes `dev.reader` et `dev.writer` ne
   peuvent pas se connecter ;
2. `app/models/prediction.py` déclare trois colonnes que le schéma d'infra ne
   contient pas : `GET /sites/{id}/predictions` répond **500**.
