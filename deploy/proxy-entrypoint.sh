#!/bin/sh
set -eu
umask 007
case "${ALLOW_PRIVATE_TARGETS:-false}" in
  false) cp /etc/squid/squid.conf /tmp/screenshot-squid.conf ;;
  true) sed '/^http_access deny private$/d' /etc/squid/squid.conf > /tmp/screenshot-squid.conf ;;
  *) echo 'ALLOW_PRIVATE_TARGETS must be true or false' >&2; exit 1 ;;
esac
if [ -n "${EGRESS_PROXY_SOCKET:-}" ]; then
  socat "UNIX-LISTEN:$EGRESS_PROXY_SOCKET,fork,unlink-early,mode=0660" TCP:127.0.0.1:3128 &
  relay_pid=$!
  squid -N -f /tmp/screenshot-squid.conf &
  squid_pid=$!
  trap 'kill "$relay_pid" "$squid_pid" 2>/dev/null || true; wait || true' EXIT
  trap 'exit 0' TERM INT
  wait -n "$relay_pid" "$squid_pid"
  exit 1
fi
exec squid -N -f /tmp/screenshot-squid.conf
