from sabanago_detection.ingest import Ingestor


class _R:
    def __init__(self, ok=True): self.ok = ok
    def raise_for_status(self):
        if not self.ok:
            raise RuntimeError("503")


class _C:
    def __init__(self): self.fail = False; self.posts = []
    def post(self, url, json, headers):
        self.posts.append(json["states"])
        return _R(not self.fail)


def test_reintenta_tras_error_de_red():
    c = _C(); ing = Ingestor("http://x", "k", "cam", client=c)
    c.fail = True
    try:
        ing.push({1: ("free", 0.9)}, now=0)
    except RuntimeError:
        pass
    c.fail = False
    ing.push({1: ("free", 0.9)}, now=1)
    assert c.posts[-1][0]["space_id"] == 1


def test_free_con_baja_confianza_se_reenvia_al_subir():
    c = _C(); ing = Ingestor("http://x", "k", "cam", client=c)
    ing.push({1: ("free", 0.5)}, now=0)
    ing.push({1: ("free", 0.95)}, now=1)
    assert c.posts[-1] and c.posts[-1][0]["confidence"] == 0.95
