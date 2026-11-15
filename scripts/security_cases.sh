#!/usr/bin/env bash
# Casos de seguridad contra la nube (hito 11, plan G 3.1): visitante, usuario y admin.
# Uso:
#   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=... \
#   [USER_JWT=...] [ADMIN_JWT=...] ./scripts/security_cases.sh
# Las llaves vienen del entorno; el script no las imprime. Con USER_JWT / ADMIN_JWT
# (access_token de una sesión) se prueban también esos roles.
set -uo pipefail
: "${SUPABASE_URL:?Falta SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?Falta SUPABASE_ANON_KEY}"
BASE="${SUPABASE_URL%/}"
fail=0

call() { # método ruta jwt [cuerpo] -> imprime "codigo|cuerpo"
  local m="$1" path="$2" jwt="$3" body="${4:-}" out
  out=$(curl -sS -m 20 -w '\n%{http_code}' -X "$m" "$BASE$path" \
    -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $jwt" \
    -H 'Content-Type: application/json' ${body:+-d "$body"})
  printf '%s|%s' "${out##*$'\n'}" "$(printf '%s' "$out" | sed '$d')"
}
check() { # nombre esperado(ok|denegado) resultado
  local name="$1" want="$2" res="$3" code="${3%%|*}" body="${3#*|}" ok=0
  if [ "$want" = ok ]; then [[ "$code" =~ ^2 ]] && ok=1
  else { [[ "$code" =~ ^(401|403)$ ]] || { [[ "$code" =~ ^2 ]] && [ "$body" = "[]" ]; }; } && ok=1; fi
  if [ $ok = 1 ]; then echo "PASS  $name ($code)"; else echo "FAIL  $name (esperado $want, HTTP $code)"; fail=1; fi
}

echo "== Visitante (llave anon)"
A="$SUPABASE_ANON_KEY"
check "lee parking_lot"                   ok       "$(call GET '/rest/v1/parking_lot?select=id&limit=1' "$A")"
check "lee space_state"                   ok       "$(call GET '/rest/v1/space_state?select=status&limit=1' "$A")"
check "get_occupancy"                     ok       "$(call POST '/rest/v1/rpc/get_occupancy' "$A" '{"lot_id":1}')"
check "lee camera_status (vista)"         ok       "$(call GET '/rest/v1/camera_status?select=id&limit=1' "$A")"
check "NO lee camera (source_url)"        denegado "$(call GET '/rest/v1/camera?select=source_url&limit=1' "$A")"
check "NO lee occupancy_log"              denegado "$(call GET '/rest/v1/occupancy_log?select=*&limit=1' "$A")"
check "NO lee favorite"                   denegado "$(call GET '/rest/v1/favorite?select=*&limit=1' "$A")"
check "NO lee push_token"                 denegado "$(call GET '/rest/v1/push_token?select=*&limit=1' "$A")"
check "NO escribe space_state"            denegado "$(call PATCH '/rest/v1/space_state?space_id=eq.1' "$A" '{"status":"free"}')"
check "NO llama ingest_space_states"      denegado "$(call POST '/rest/v1/rpc/ingest_space_states' "$A" '{"camera_id":1,"states":[]}')"
check "NO llama admin_upsert_space"       denegado "$(call POST '/rest/v1/rpc/admin_upsert_space' "$A" '{"payload":{}}')"
check "NO llama get_occupancy_history"    denegado "$(call POST '/rest/v1/rpc/get_occupancy_history' "$A" '{"lot_id":1,"from_ts":"2026-11-01T00:00:00Z","to_ts":"2026-11-02T00:00:00Z","bucket":"1 hour"}')"

if [ -n "${USER_JWT:-}" ]; then
  echo "== Usuario sin rol admin"
  U="$USER_JWT"
  check "NO llama admin_set_zone_active (403)" denegado "$(call POST '/rest/v1/rpc/admin_set_zone_active' "$U" '{"zone_id":1,"active":false}')"
  check "NO llama admin_delete_space (403)"    denegado "$(call POST '/rest/v1/rpc/admin_delete_space' "$U" '{"space_id":1}')"
  check "NO lee camera"                        denegado "$(call GET '/rest/v1/camera?select=source_url&limit=1' "$U")"
  check "NO llama ingest_space_states"         denegado "$(call POST '/rest/v1/rpc/ingest_space_states' "$U" '{"camera_id":1,"states":[]}')"
else echo "(sin USER_JWT: se omiten los casos de usuario)"; fi

if [ -n "${ADMIN_JWT:-}" ]; then
  echo "== Admin"
  check "admin lee get_occupancy_history" ok "$(call POST '/rest/v1/rpc/get_occupancy_history' "$ADMIN_JWT" '{"lot_id":1,"from_ts":"2026-11-01T00:00:00Z","to_ts":"2026-11-02T00:00:00Z","bucket":"1 hour"}')"
else echo "(sin ADMIN_JWT: se omite el caso de admin)"; fi

echo "== Transporte y repo"
case "$BASE" in https://*) echo "PASS  la URL usa HTTPS";; *) echo "FAIL  la URL no usa HTTPS"; fail=1;; esac
if git grep -nE 'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.' -- . ':!*.lock' ':!package-lock.json' >/dev/null 2>&1; then
  echo "FAIL  hay un JWT escrito en el repo"; fail=1
else echo "PASS  ningún JWT escrito en el repo"; fi

[ $fail = 0 ] && echo "TODOS LOS CASOS PASAN" || echo "HAY CASOS QUE FALLAN"
exit $fail
