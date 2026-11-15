"""Deja los puestos de la Maqueta en free y la camara en linea antes de cada ensayo.

Uso: python -m sabanago_detection.tools.demo_reset [--lot "Maqueta demo"]
Llama a la RPC ingest_space_states (confianza 1) solo con las camaras del
parqueadero indicado, asi que otros parqueaderos (Alejandria) no cambian.
"""
import argparse

import httpx

from sabanago_detection.tools._rest import client_headers, credentials


def build_free_states(spaces):
    """Estados 'free' con confianza 1 para todos los puestos dados."""
    return [{"space_id": s["id"], "status": "free", "confidence": 1} for s in spaces]


def reset_lot(client, url, key, lot_name):
    """Devuelve {camera_id: puestos_aplicados}. Falla si el parqueadero no existe."""
    h = client_headers(key)
    r = client.get(f"{url}/rest/v1/parking_lot",
                   params={"name": f"eq.{lot_name}", "select": "id"}, headers=h)
    r.raise_for_status()
    lots = r.json()
    if not lots:
        raise SystemExit(f"No existe el parqueadero '{lot_name}'.")
    r = client.get(f"{url}/rest/v1/camera",
                   params={"parking_lot_id": f"eq.{lots[0]['id']}", "select": "id"},
                   headers=h)
    r.raise_for_status()
    result = {}
    for cam in r.json():
        r = client.get(f"{url}/rest/v1/space",
                       params={"camera_id": f"eq.{cam['id']}", "is_active": "eq.true",
                               "select": "id"}, headers=h)
        r.raise_for_status()
        r = client.post(f"{url}/rest/v1/rpc/ingest_space_states",
                        json={"camera_id": cam["id"],
                              "states": build_free_states(r.json())}, headers=h)
        r.raise_for_status()
        result[cam["id"]] = r.json()
    return result


def main():  # pragma: no cover - necesita Supabase
    ap = argparse.ArgumentParser()
    ap.add_argument("--lot", default="Maqueta demo")
    a = ap.parse_args()
    url, key = credentials()
    with httpx.Client(timeout=5.0) as client:
        for cam, n in reset_lot(client, url, key, a.lot).items():
            print(f"camara {cam}: {n} puestos en free")


if __name__ == "__main__":
    main()
