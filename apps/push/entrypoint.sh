#!/bin/sh
set -eu

# Fly Postgres attaches as DATABASE_URL; the server reads DB_CONNECTION_STRING.
if [ -z "${DB_CONNECTION_STRING:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  export DB_CONNECTION_STRING="$DATABASE_URL"
fi

if [ -z "${DB_CONNECTION_STRING:-}" ]; then
  echo "DB_CONNECTION_STRING (or DATABASE_URL) is required" >&2
  exit 1
fi

set -- \
  --api \
  --api-port "${API_PORT:-8080}" \
  --xmtp-listener \
  --xmtp-address "${XMTP_GRPC_ADDRESS:-production.xmtp.network:5556}" \
  --listener-type "${LISTENER_TYPE:-v3}" \
  --num-workers "${NUM_WORKERS:-50}" \
  --log-encoding "${LOG_ENCODING:-json}" \
  --log-level "${LOG_LEVEL:-info}"

if [ "${XMTP_LISTENER_TLS:-true}" = "true" ]; then
  set -- "$@" --xmtp-listener-tls
fi

# Delivery backends switch on when their credentials are present.
if [ -n "${FCM_CREDENTIALS_JSON:-}" ]; then
  set -- "$@" --fcm-enabled
fi

if [ -n "${APNS_P8_CERTIFICATE:-}" ] || [ -n "${APNS_P8_CERTIFICATE_FILE_PATH:-}" ]; then
  set -- "$@" --apns-enabled
fi

exec /usr/bin/notifications-server "$@"
