#!/usr/bin/env bash
# Respaldo de la base de la demo (pg_dump) y restauración opcional en la base local.
# Uso:
#   DEMO_DB_URL=postgresql://... ./scripts/backup_db.sh backup [archivo]
#   LOCAL_DB_URL=postgresql://... ./scripts/backup_db.sh restore archivo
# Las cadenas de conexión vienen del entorno; el script no las imprime.
set -euo pipefail

cmd="${1:-}"
file="${2:-backups/sabanago_$(date +%Y%m%d_%H%M%S).dump}"

case "$cmd" in
  backup)
    : "${DEMO_DB_URL:?Falta DEMO_DB_URL (cadena de conexión de la demo)}"
    mkdir -p "$(dirname "$file")"
    # Solo el esquema public; auth y storage los administra Supabase.
    pg_dump --format=custom --no-owner --no-privileges --schema=public \
      --dbname="$DEMO_DB_URL" --file="$file"
    echo "Respaldo guardado en $file"
    ;;
  restore)
    : "${LOCAL_DB_URL:?Falta LOCAL_DB_URL (base local, p. ej. de supabase start)}"
    [ -f "${2:-}" ] || { echo "Uso: $0 restore archivo.dump" >&2; exit 1; }
    # --clean --if-exists deja la base local igual al respaldo.
    pg_restore --clean --if-exists --no-owner --no-privileges \
      --dbname="$LOCAL_DB_URL" "$2"
    echo "Restaurado en la base local. Verifica: select * from public.get_occupancy(<lot_id>);"
    ;;
  *)
    echo "Uso: $0 backup [archivo] | restore archivo" >&2
    exit 1
    ;;
esac
