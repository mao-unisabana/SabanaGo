"""ingest: >=5 lotes en 10 s sin cambios (latido), con HTTP falso."""
import httpx

from sabanago_detection.ingest import Ingestor


class FakeTransport(httpx.BaseTransport):
    def __init__(self):
        self.posts = []
        self.spaces = [{"id": 1, "code": "M1", "image_polygon": [[0, 0]]}]

    def handle_request(self, request):
        if request.url.path.endswith("/rpc/ingest_space_states"):
            import json
            self.posts.append(json.loads(request.content))
            return httpx.Response(200, json={})
        # GET space
        return httpx.Response(200, json=self.spaces)


def test_latido_5_lotes_en_10s():
    ft = FakeTransport()
    client = httpx.Client(transport=ft, base_url="http://x")
    ing = Ingestor("http://x", "k", camera_id=1, interval_s=1.5, client=client)

    states = {1: ("free", 0.9)}
    # simula 10 s avanzando el reloj; nada cambia tras el primer envio
    t = 0.0
    while t <= 10.0:
        ing.push(states, now=t)
        t += 0.5

    assert len(ft.posts) >= 5, f"esperados >=5 lotes, hubo {len(ft.posts)}"
    # el primero lleva el cambio; los demas son latidos vacios
    assert ft.posts[0]["states"] == [
        {"space_id": 1, "status": "free", "confidence": 0.9}
    ]
    assert ft.posts[-1]["states"] == []


def test_relee_puestos():
    ft = FakeTransport()
    client = httpx.Client(transport=ft, base_url="http://x")
    ing = Ingestor("http://x", "k", camera_id=1, spaces_ttl_s=60.0, client=client)
    assert ing.spaces(now=0.0)[0]["code"] == "M1"
    # dentro del TTL: no re-lee (misma lista cacheada)
    assert ing.spaces(now=30.0)[0]["code"] == "M1"
