# Image de production du dashboard — build Vite figé, servi en statique par Nginx.
# Multi-stage : le toolchain Node ne suit pas dans l'image finale, qui ne
# contient que les fichiers compilés et Nginx.

# --- Étape 1 : compilation du bundle de production -------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Dépendances d'abord (lock épinglé) pour profiter du cache de couches.
COPY package.json package-lock.json ./
RUN npm ci

# Sources + génération du bundle (tsc -b && vite build -> /app/dist).
COPY . .
RUN npm run build

# --- Étape 2 : service des fichiers statiques -----------------------------
# Image Nginx non-root : écoute sur 8080, tourne en uid 101, aucun toolchain.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# La base nginx-unprivileged:1.27-alpine est un tag flottant : son contenu
# dérive entre deux constructions sans que le Dockerfile change, et Grype (job
# sca-grype de la CI) l'a rattrapé — libcrypto3, libssl3, libxml2, curl,
# libpng, libexpat, nghttp2-libs, tous en retard sur leur correctif au sein de
# la même version mineure d'Alpine. `apk upgrade` les met à niveau sans
# changer la version d'Alpine elle-même, donc sans risque de compatibilité :
# --no-cache évite de laisser un index de paquets périmé dans l'image.
#
# L'image tourne en uid 101 (nginx) par défaut, sans droit d'écriture sur la
# base apk : `USER root` le temps de la mise à jour, puis retour explicite à
# l'utilisateur non privilégié. Rien d'autre ne tourne jamais en root — ni le
# serveur, ni le conteneur final.
USER root
RUN apk update && apk upgrade --no-cache
USER nginx

# Configuration : fallback SPA + cache des assets + /healthz.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Les en-têtes de sécurité sont un modèle, pas un fichier figé : l'entrée de
# l'image passe /etc/nginx/templates/*.template à envsubst au démarrage du
# conteneur, ce qui permet de décider les origines autorisées par connect-src
# au déploiement plutôt qu'au build. L'image est construite une fois par commit
# et déployée telle quelle sur des environnements dont les domaines diffèrent :
# figer la CSP au build imposerait une image par environnement.
COPY security-headers.conf.template /etc/nginx/templates/security-headers.conf.template

# Même mécanisme pour les adresses de service : Vite les figerait au build,
# alors que l'image est construite une fois par commit puis déployée telle
# quelle sur des environnements dont les domaines diffèrent. Servi sur
# /config.js et chargé par index.html avant le bundle.
COPY config.js.template /etc/nginx/templates/config.js.template

# Sortie de la substitution dans /etc/nginx/ et non le défaut /etc/nginx/conf.d/ :
# ce dernier est chargé en bloc par `include /etc/nginx/conf.d/*.conf` du
# nginx.conf de base, et le fichier d'en-têtes s'y appliquerait aussi au
# contexte http, en plus des trois endroits qui l'incluent délibérément.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx

# Origines supplémentaires autorisées par connect-src, en plus de 'self'.
# DÉCLARÉE ICI MÊME VIDE, et c'est indispensable : envsubst ne substitue que
# les variables réellement définies dans l'environnement, et laisserait sinon
# le littéral « ${CSP_CONNECT_SRC} » dans la CSP produite. Vide, le dashboard
# ne peut appeler que sa propre origine — un défaut qui échoue en se fermant.
# À renseigner au déploiement, voir security-headers.conf.template.
ENV CSP_CONNECT_SRC=""

# Adresses de service lues par l'application au démarrage. Déclarées ici même
# vides, pour la même raison que CSP_CONNECT_SRC : envsubst laisserait sinon
# le littéral « ${...} » dans config.js. Vides, l'application retombe sur
# import.meta.env, c'est-à-dire le .env du poste de développement.
ENV API_BASE_URL=""
ENV PREDICTION_SOURCE=""

# Uniquement le résultat du build, rien d'autre du dépôt.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# La commande par défaut de l'image de base lance déjà Nginx au premier plan.
