#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
API_PORT="${API_PORT:-3000}"
SOCKET_PORT="${SOCKET_PORT:-3001}"
EXPO_PORT="${EXPO_PORT:-8081}"
EXPO_MODE="expo-go"

if [ "${1:-}" = "--dev-client" ]; then
  EXPO_MODE="dev-client"
fi

detect_ip() {
  if [ -n "${TRUEBPM_LOCAL_IP:-}" ]; then
    printf "%s" "$TRUEBPM_LOCAL_IP"
    return
  fi

  for iface in en0 en1 en2 bridge100; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [ -n "$ip" ]; then
      printf "%s" "$ip"
      return
    fi
  done

  ip=$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}' | xargs -I{} ipconfig getifaddr {} 2>/dev/null || true)
  if [ -n "$ip" ]; then
    printf "%s" "$ip"
    return
  fi

  printf "127.0.0.1"
}

HOST_IP=$(detect_ip)
API_URL="http://$HOST_IP:$API_PORT"
SOCKET_URL="http://$HOST_IP:$SOCKET_PORT"
PIDS=""
LOG_FILES=""

is_port_busy() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

first_free_port() {
  port="$1"
  while is_port_busy "$port"; do
    port=$((port + 1))
  done
  printf "%s" "$port"
}

EXPO_PORT=$(first_free_port "$EXPO_PORT")

printf "\nTrueBPM local launcher\n"
printf "API:    %s\n" "$API_URL"
printf "Socket: %s\n" "$SOCKET_URL"
printf "Expo:   LAN mode on port %s (%s)\n\n" "$EXPO_PORT" "$EXPO_MODE"

cleanup() {
  printf "\nStopping TrueBPM local services...\n"
  for pid in $PIDS; do
    kill "$pid" 2>/dev/null || true
  done
}

trap cleanup INT TERM EXIT

run_service() {
  name="$1"
  command="$2"
  log_file="/tmp/truebpm-$name.log"

  printf "Starting %s...\n" "$name"
  sh -c "$command" >"$log_file" 2>&1 &
  pid=$!
  PIDS="${PIDS:-} $pid"
  LOG_FILES="${LOG_FILES:-} $log_file"
  printf "  pid %s, logs: %s\n" "$pid" "$log_file"
}

if is_port_busy "$API_PORT"; then
  printf "API already running on port %s. Reusing it.\n" "$API_PORT"
else
  run_service "api" "cd '$ROOT_DIR/apps/api' && pnpm exec next dev -H 0.0.0.0 -p '$API_PORT'"
fi

if is_port_busy "$SOCKET_PORT"; then
  printf "Socket already running on port %s. Reusing it.\n" "$SOCKET_PORT"
else
  run_service "socket" "cd '$ROOT_DIR/apps/api' && SOCKET_PORT='$SOCKET_PORT' pnpm socket"
fi

if [ "$EXPO_MODE" = "dev-client" ]; then
  MOBILE_ARGS="--dev-client"
else
  MOBILE_ARGS="--go"
fi

printf "\nAPI log:    tail -f /tmp/truebpm-api.log\n"
printf "Socket log: tail -f /tmp/truebpm-socket.log\n\n"
printf "Starting Expo in the foreground so the QR code stays visible...\n\n"

cd "$ROOT_DIR/apps/mobile"
EXPO_PUBLIC_API_URL="$API_URL" \
EXPO_PUBLIC_SOCKET_URL="$SOCKET_URL" \
pnpm exec expo start -c --host lan --port "$EXPO_PORT" $MOBILE_ARGS
