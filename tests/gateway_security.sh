#!/bin/sh
# Scan the built image without exposing the Docker socket to the scanner.
set -eu

image=${1:-screenshot-gateway:ci}
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT HUP INT TERM
docker save "$image" -o "$scan_dir/gateway.tar"
docker run --rm -v "$scan_dir:/images:ro" \
  aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb \
  image --input /images/gateway.tar --scanners vuln \
  --severity HIGH,CRITICAL --ignore-unfixed --ignorefile /dev/null --exit-code 1
