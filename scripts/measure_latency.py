#!/usr/bin/env python3
"""RNF-01: latencia ingesta -> evento Realtime (mediana y p95 en 50 cambios).

Alterna el estado de un puesto con ingest_space_states y mide el tiempo hasta
recibir el evento Realtime de space_state en un cliente suscrito a la zona.
No mide el pintado en el celular (eso va aparte, con video).

Variables de entorno (nunca se imprimen):
  SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  CAMERA_ID, SPACE_ID, ZONE_ID   (el puesto debe pertenecer a esa cámara y zona)
  N_CHANGES (opcional, 50)

Requiere: pip install httpx websockets
"""
import json
import os
import statistics
import sys
import time

import httpx
from websockets.sync.client import connect

N = int(os.environ.get("N_CHANGES", "50"))
WAIT_S = 10.0  # espera máxima por evento antes de darlo por perdido


def env(name):
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Falta la variable de entorno {name}")
    return value


def percentile(values, p):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(p / 100 * (len(ordered) - 1))))]


def main():
    url = env("SUPABASE_URL").rstrip("/")
    anon = env("SUPABASE_ANON_KEY")
    service = env("SUPABASE_SERVICE_ROLE_KEY")
    camera_id, space_id, zone_id = int(env("CAMERA_ID")), int(env("SPACE_ID")), int(env("ZONE_ID"))

    ws_url = url.replace("https://", "wss://").replace("http://", "ws://")
    ws = connect(f"{ws_url}/realtime/v1/websocket?apikey={anon}&vsn=1.0.0")
    topic = f"realtime:latency-{zone_id}"
    ws.send(json.dumps({
        "topic": topic, "event": "phx_join", "ref": "1",
        "payload": {"config": {"postgres_changes": [
            {"event": "UPDATE", "schema": "public", "table": "space_state", "filter": f"zone_id=eq.{zone_id}"}
        ]}},
    }))
    time.sleep(2)  # deja que la suscripción quede activa

    headers = {"apikey": service, "Authorization": f"Bearer {service}"}
    client = httpx.Client(timeout=10.0)
    latencies, lost, status = [], 0, "free"
    last_beat = time.monotonic()

    for _ in range(N):
        status = "occupied" if status == "free" else "free"
        t0 = time.monotonic()
        r = client.post(
            f"{url}/rest/v1/rpc/ingest_space_states",
            json={"camera_id": camera_id, "states": [{"space_id": space_id, "status": status, "confidence": 0.95}]},
            headers=headers,
        )
        r.raise_for_status()
        got = False
        while time.monotonic() - t0 < WAIT_S:
            try:
                msg = json.loads(ws.recv(timeout=1.0))
            except TimeoutError:
                continue
            if msg.get("event") == "postgres_changes":
                record = msg["payload"]["data"].get("record", {})
                if record.get("space_id") == space_id and record.get("status") == status:
                    latencies.append(time.monotonic() - t0)
                    got = True
                    break
        lost += 0 if got else 1
        if time.monotonic() - last_beat > 20:
            ws.send(json.dumps({"topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": "hb"}))
            last_beat = time.monotonic()
        time.sleep(1)  # separa los cambios para no mezclar eventos

    ws.close()
    if not latencies:
        sys.exit("No se recibió ningún evento Realtime")
    print(f"cambios={N} recibidos={len(latencies)} perdidos={lost}")
    print(f"mediana={statistics.median(latencies):.3f} s  p95={percentile(latencies, 95):.3f} s  (meta RNF-01: p95 <= 5 s)")


if __name__ == "__main__":
    main()
