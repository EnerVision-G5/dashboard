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

# Configuration : fallback SPA + cache des assets + /healthz. Les en-têtes de
# sécurité vivent dans security-headers.conf, réinclus par nginx.conf en
# chemin absolu dans chaque location qui pose son propre add_header — un
# chemin relatif s'y résout contre le préfixe /etc/nginx/, pas contre le
# répertoire du fichier qui l'inclut, ce qui a fait échouer une première
# tentative. Deux COPY plutôt qu'un seul avec plusieurs sources : ce dernier
# imposerait une destination-répertoire et interdirait de renommer nginx.conf
# au passage.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/conf.d/security-headers.conf

# Uniquement le résultat du build, rien d'autre du dépôt.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# La commande par défaut de l'image de base lance déjà Nginx au premier plan.
