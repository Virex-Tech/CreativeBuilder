#!/bin/sh
# Starts as root only to make the output dir writable (it may be a volume created by an older,
# root-run container), then drops to the unprivileged `node` user for the actual service.
set -e
if [ "$(id -u)" = "0" ]; then
	OUT="${RENDER_OUT_DIR:-/app/out}"
	mkdir -p "$OUT"
	chown node:node "$OUT"
	exec setpriv --reuid=node --regid=node --init-groups -- "$@"
fi
exec "$@"
