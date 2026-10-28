#!/bin/sh
set -eu
case "${ALLOW_PRIVATE_TARGETS:-false}" in
  false) cp /etc/squid/squid.conf /tmp/screenshot-squid.conf ;;
  true) sed '/^http_access deny private$/d' /etc/squid/squid.conf > /tmp/screenshot-squid.conf ;;
  *) echo 'ALLOW_PRIVATE_TARGETS must be true or false' >&2; exit 1 ;;
esac
exec squid -N -f /tmp/screenshot-squid.conf
