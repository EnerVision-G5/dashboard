#!/usr/bin/env bash
#
# Scan OWASP ZAP (baseline) d'une image du dashboard déjà présente en local.
#
#   .github/scripts/zap-baseline.sh <image>
#
# Le dashboard et ZAP tournent dans deux conteneurs sur un réseau Docker
# dédié : pas de --network host, donc le même script vaut sur le runner et sur
# un poste. Les rapports sortent dans ./zap-report ; le code de sortie est
# celui de zap-baseline.py (1 sur FAIL, 2 sur WARN non listé dans
# .zap/rules.tsv), rien ne l'atténue.

set -euo pipefail

image="${1:?image à scanner}"
zap_image="ghcr.io/zaproxy/zaproxy:2.17.0@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef"
net="zap-scan-$$"
target="dashboard-scan-$$"

cleanup() {
  docker logs "$target" 2>/dev/null | tail -n 20 || true
  docker rm -f "$target" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$net" >/dev/null
docker run -d --name "$target" --network "$net" "$image" >/dev/null

# Sonde depuis le réseau du scan, pas depuis l'hôte : aucun port à publier.
for _ in $(seq 1 30); do
  if docker run --rm --network "$net" curlimages/curl:8.14.1@sha256:9a1ed35addb45476afa911696297f8e115993df459278ed036182dd2cd22b67b \
       -fsS "http://$target:8080/healthz" >/dev/null 2>&1; then
    ok=1
    break
  fi
  ok=0
  sleep 1
done
test "${ok:-0}" = 1

# Le conteneur ZAP écrit ses rapports sous l'uid 1000 alors que l'hôte est un
# autre utilisateur : répertoire dédié, vide et jeté avec le job, ouvert en
# écriture.
rm -rf zap-report
install -d -m 0777 zap-report
cp .zap/rules.tsv zap-report/rules.tsv

docker run --rm --network "$net" \
  -v "$PWD/zap-report:/zap/wrk:rw" \
  "$zap_image" \
  zap-baseline.py \
    -t "http://$target:8080" \
    -c rules.tsv \
    -r rapport.html \
    -w rapport.md \
    -J rapport.json
