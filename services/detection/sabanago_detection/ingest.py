"""Cliente de Supabase: lee puestos y envia estados a ingest_space_states.

Envia SOLO los puestos cuyo estado reportado cambio, pero manda un lote (aunque
vacio) al menos cada INGEST_INTERVAL_S como latido. Relee puestos cada 60 s.
"""
import time

import httpx

MIN_CONFIDENCE = 0.7  # mismo umbral que aplica la RPC en SQL


class Ingestor:
    def __init__(self, url, service_key, camera_id, interval_s=1.5,
                 spaces_ttl_s=60.0, client=None):
        self.base = url.rstrip("/")
        self.key = service_key
        self.camera_id = camera_id
        self.interval_s = interval_s
        self.spaces_ttl_s = spaces_ttl_s
        self.client = client or httpx.Client(timeout=5.0)
        self._reported = {}        # space_id -> status enviado
        self._last_sent = 0.0
        self._spaces = []
        self._spaces_at = 0.0

    def _headers(self):
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}"}

    def spaces(self, now=None):
        """Puestos activos de la camara, releidos cada spaces_ttl_s."""
        now = now if now is not None else time.monotonic()
        if not self._spaces or (now - self._spaces_at) >= self.spaces_ttl_s:
            r = self.client.get(
                f"{self.base}/rest/v1/space",
                params={"camera_id": f"eq.{self.camera_id}",
                        "is_active": "eq.true",
                        "select": "id,code,image_polygon"},
                headers=self._headers(),
            )
            r.raise_for_status()
            self._spaces = r.json()
            self._spaces_at = now
        return self._spaces

    def _post(self, states):
        r = self.client.post(
            f"{self.base}/rest/v1/rpc/ingest_space_states",
            json={"camera_id": self.camera_id, "states": states},
            headers=self._headers(),
        )
        r.raise_for_status()

    def push(self, states, now=None):
        """states: dict[space_id, (status, confidence)]. Envia cambios o latido.

        Devuelve True si hubo POST (hay que enviar cambios, o toco latido).
        """
        now = now if now is not None else time.monotonic()
        changed = []
        pending = {}
        for sid, (status, conf) in states.items():
            # La BD guarda no_data si la confianza es < umbral; se compara contra eso.
            effective = status if conf >= MIN_CONFIDENCE else "no_data"
            if self._reported.get(sid) != effective:
                changed.append({"space_id": sid, "status": status,
                                "confidence": conf})
                pending[sid] = effective
        due = (now - self._last_sent) >= self.interval_s
        if changed or due:
            self._post(changed)  # si falla, no se marca nada y se reintenta
            self._reported.update(pending)
            self._last_sent = now
            return True
        return False
