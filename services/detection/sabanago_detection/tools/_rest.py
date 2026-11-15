"""Acceso REST a Supabase para las herramientas de la demo.

La llave service_role se lee SOLO de la variable de entorno; nunca se imprime.
"""
import os
import sys

import httpx


def credentials():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        sys.exit("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.")
    return url, key


def client_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}"}
